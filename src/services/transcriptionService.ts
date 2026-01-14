/**
 * Transcription Service
 * 
 * Provides live transcription capabilities using various engines.
 * Currently supports AssemblyAI with an abstraction layer for future engines.
 * 
 * This service handles:
 * - Audio capture from microphone
 * - Real-time transcription via WebSocket
 * - Interim and final transcript handling
 */

import {
  TranscriptionEngine,
  TranscriptionCallbacks,
  TranscriptionSegment,
  SmartVasisSettings,
  SMART_VASIS_SETTINGS_KEY,
  DEFAULT_SMART_VASIS_SETTINGS,
} from "../types/smartVasis";

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

/**
 * Load SmartVasis settings from localStorage
 */
export function loadSmartVasisSettings(): SmartVasisSettings {
  try {
    const stored = localStorage.getItem(SMART_VASIS_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SMART_VASIS_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.error("Failed to load SmartVasis settings:", err);
  }
  return { ...DEFAULT_SMART_VASIS_SETTINGS };
}

/**
 * Save SmartVasis settings to localStorage
 */
export function saveSmartVasisSettings(settings: SmartVasisSettings): void {
  try {
    localStorage.setItem(SMART_VASIS_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save SmartVasis settings:", err);
  }
}

// =============================================================================
// ABSTRACT TRANSCRIPTION SERVICE
// =============================================================================

/**
 * Abstract transcription service interface
 */
export interface ITranscriptionService {
  engine: TranscriptionEngine;
  isRecording: boolean;
  startTranscription(): Promise<void>;
  stopTranscription(): Promise<void>;
  getMicrophoneDevices(): Promise<MediaDeviceInfo[]>;
  setMicrophone(deviceId: string): void;
}

// =============================================================================
// ASSEMBLYAI TRANSCRIPTION SERVICE
// =============================================================================

/**
 * AssemblyAI Real-time Transcription Service
 * 
 * Uses AssemblyAI's WebSocket API for live transcription.
 * Audio is captured from the microphone, encoded, and sent to AssemblyAI.
 */
export class AssemblyAITranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = 'assemblyai';
  
  private apiKey: string = '';
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private selectedMicId: string = '';
  private callbacks: TranscriptionCallbacks = {};
  private _isRecording: boolean = false;
  private segmentCounter: number = 0;
  private interimTexts: Record<number, string> = {};

  constructor(apiKey: string, callbacks: TranscriptionCallbacks = {}) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Update the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: TranscriptionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get available microphone devices
   */
  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // Request permission first to get full device list
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting microphone devices:', error);
      return [];
    }
  }

  /**
   * Set the selected microphone device
   */
  setMicrophone(deviceId: string): void {
    this.selectedMicId = deviceId;
  }

  /**
   * Get a temporary token from AssemblyAI
   * This should ideally be done server-side, but for Tauri apps we can do it client-side
   */
  private async getTemporaryToken(): Promise<string> {
    try {
      const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_in: 3600, // 1 hour
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting AssemblyAI token:', error);
      throw error;
    }
  }

  /**
   * Start live transcription
   */
  async startTranscription(): Promise<void> {
    if (this._isRecording) {
      console.warn('Transcription already in progress');
      return;
    }

    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    this.callbacks.onStatusChange?.('connecting');

    try {
      // Get temporary token
      const token = await this.getTemporaryToken();

      // Connect to WebSocket
      await this.connectWebSocket(token);

      // Start audio capture
      await this.startAudioCapture();

      this._isRecording = true;
      this.callbacks.onStatusChange?.('recording');
      console.log('✅ AssemblyAI transcription started');
    } catch (error) {
      this.callbacks.onStatusChange?.('error');
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Connect to AssemblyAI WebSocket
   */
  private connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('🔌 AssemblyAI WebSocket connected');
        resolve();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleTranscriptMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks.onError?.(new Error('WebSocket connection error'));
        reject(error);
      };

      this.socket.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
        this._isRecording = false;
        this.callbacks.onConnectionClose?.(event.code, event.reason);
        this.callbacks.onStatusChange?.('idle');
      };

      // Timeout for connection
      setTimeout(() => {
        if (this.socket?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming transcript messages
   */
  private handleTranscriptMessage(message: { message_type: string; audio_start?: number; text?: string }): void {
    if (message.message_type === 'PartialTranscript' && message.text) {
      // Interim transcript
      const audioStart = message.audio_start || 0;
      this.interimTexts[audioStart] = message.text;
      
      // Combine all interim texts
      const keys = Object.keys(this.interimTexts).map(Number).sort((a, b) => a - b);
      const combinedText = keys.map(key => this.interimTexts[key]).join(' ').trim();
      
      this.callbacks.onInterimTranscript?.(combinedText);
    } else if (message.message_type === 'FinalTranscript' && message.text) {
      // Final transcript
      const segment: TranscriptionSegment = {
        id: `segment-${++this.segmentCounter}`,
        text: message.text,
        timestamp: Date.now(),
        isFinal: true,
      };
      
      this.callbacks.onFinalTranscript?.(message.text, segment);
      
      // Clear interim texts
      this.interimTexts = {};
    }
  }

  /**
   * Start audio capture from microphone
   */
  private async startAudioCapture(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: this.selectedMicId 
          ? { deviceId: { exact: this.selectedMicId } }
          : true,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create AudioContext for processing
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create script processor for audio data
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert float32 to int16
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send audio data
        this.socket.send(pcmData.buffer);
      };
      
      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      console.log('🎤 Audio capture started');
    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  }

  /**
   * Stop transcription
   */
  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping transcription...');
    this._isRecording = false;

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Stop media recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    // Close WebSocket
    if (this.socket) {
      // Send terminate message
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ terminate_session: true }));
      }
      this.socket.close();
      this.socket = null;
    }

    // Reset state
    this.interimTexts = {};
    this.callbacks.onStatusChange?.('idle');
    console.log('✅ Transcription stopped');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopTranscription();
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a transcription service instance based on the configured engine
 */
export function createTranscriptionService(
  settings: SmartVasisSettings,
  callbacks: TranscriptionCallbacks
): ITranscriptionService {
  switch (settings.transcriptionEngine) {
    case 'assemblyai':
      return new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey || '',
        callbacks
      );
    // Future engines can be added here
    // case 'elevenlabs':
    //   return new ElevenLabsTranscriptionService(settings, callbacks);
    // case 'whisper':
    //   return new WhisperTranscriptionService(settings, callbacks);
    default:
      return new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey || '',
        callbacks
      );
  }
}

// Note: ITranscriptionService is already exported in its interface declaration
