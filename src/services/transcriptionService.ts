/**
 * Transcription Service
 * 
 * Provides live transcription capabilities using AssemblyAI Realtime API.
 * Uses RealtimeTranscriber from AssemblyAI SDK and RecordRTC for audio capture.
 * 
 * This service handles:
 * - Audio capture from microphone using RecordRTC
 * - Real-time transcription via AssemblyAI WebSocket
 * - Interim and final transcript handling
 */

import { RealtimeTranscriber } from 'assemblyai/streaming';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { getAssemblyAITemporaryToken } from "./assemblyaiTokenService";
import {
  TranscriptionEngine,
  TranscriptionCallbacks,
  TranscriptionSegment,
  SmartVersesSettings,
  SMART_VERSES_SETTINGS_KEY,
  DEFAULT_SMART_VERSES_SETTINGS,
} from "../types/smartVerses";

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

/**
 * Load SmartVerses settings from localStorage
 */
export function loadSmartVersesSettings(): SmartVersesSettings {
  try {
    const stored = localStorage.getItem(SMART_VERSES_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SMART_VERSES_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.error("Failed to load SmartVerses settings:", err);
  }
  return { ...DEFAULT_SMART_VERSES_SETTINGS };
}

/**
 * Save SmartVerses settings to localStorage
 */
export function saveSmartVersesSettings(settings: SmartVersesSettings): void {
  try {
    localStorage.setItem(SMART_VERSES_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save SmartVerses settings:", err);
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
 * Uses AssemblyAI's RealtimeTranscriber and RecordRTC for live transcription.
 * Audio is captured from the microphone at 16kHz sample rate and sent to AssemblyAI.
 */
export class AssemblyAITranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = 'assemblyai';
  
  private apiKey: string = '';
  private realtimeTranscriber: RealtimeTranscriber | null = null;
  private recorder: RecordRTC | null = null;
  private mediaStream: MediaStream | null = null; // Store stream reference separately
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
   */
  private async getTemporaryToken(): Promise<string> {
    try {
      console.log('🔑 Requesting temporary token from AssemblyAI...');
      const token = await getAssemblyAITemporaryToken(this.apiKey, 3600);
      console.log('✅ Token received successfully');
      return token;
    } catch (error) {
      console.error('Error getting AssemblyAI token:', error);
      throw error;
    }
  }

  /**
   * Clean up existing connections and recorder
   */
  private async cleanup(): Promise<void> {
    // Clean up existing transcriber
    if (this.realtimeTranscriber) {
      console.log('⚠️ Existing transcriber found, cleaning up...');
      try {
        await this.realtimeTranscriber.close();
      } catch (error) {
        console.error('Error closing existing transcriber:', error);
      }
      this.realtimeTranscriber = null;
    }

    // Clean up existing recorder and stream
    if (this.recorder) {
      console.log('⚠️ Existing recorder found, cleaning up...');
      this.recorder.destroy();
      this.recorder = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.mediaStream = null;
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
      // Clean up any existing connections
      await this.cleanup();

      console.log('🎬 Creating new RealtimeTranscriber...');

      // Get temporary token
      const token = await this.getTemporaryToken();

      // Initialize RealtimeTranscriber with the AssemblyAI SDK
      this.realtimeTranscriber = new RealtimeTranscriber({
        token,
        sampleRate: 16000, // Required: 16kHz sample rate
      });

      // Handle interim transcripts (live updates)
      this.realtimeTranscriber.on('transcript', (data: { audio_start: number; text: string }) => {
        this.interimTexts[data.audio_start] = data.text;
        const keys = Object.keys(this.interimTexts)
          .map(Number)
          .sort((a, b) => a - b);
        const combinedText = keys.map((key) => this.interimTexts[key]).join(' ').trim();
        this.callbacks.onInterimTranscript?.(combinedText);
      });

      // Handle final transcripts (complete sentences)
      this.realtimeTranscriber.on('transcript.final', (finalData: { text: string }) => {
        console.log('📝 Final transcript:', finalData.text);

        const segment: TranscriptionSegment = {
          id: `segment-${++this.segmentCounter}`,
          text: finalData.text,
          timestamp: Date.now(),
          isFinal: true,
        };

        this.callbacks.onFinalTranscript?.(finalData.text, segment);

        // Clear interim texts
        this.interimTexts = {};
      });

      // Handle errors
      this.realtimeTranscriber.on('error', (event: { message?: string }) => {
        console.error('❌ Transcription error:', event);
        this.callbacks.onError?.(new Error(event.message || 'Transcription error'));
        this.stopTranscription();
      });

      // Handle connection close
      this.realtimeTranscriber.on('close', (code: number, reason: string) => {
        console.log(`🔌 Connection closed: ${code} ${reason}`);
        this._isRecording = false;
        this.callbacks.onConnectionClose?.(code, reason);
        this.callbacks.onStatusChange?.('idle');
      });

      // Connect to AssemblyAI
      console.log('🔌 Connecting to AssemblyAI WebSocket...');
      await this.realtimeTranscriber.connect();
      console.log('✅ WebSocket connected');

      // Get microphone access and start recording
      const constraints: MediaStreamConstraints = {
        audio: this.selectedMicId
          ? { deviceId: { exact: this.selectedMicId } }
          : true,
      };

      console.log('🎤 Requesting microphone access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Microphone access granted');

      // Initialize RecordRTC with the correct settings
      this.recorder = new RecordRTC(this.mediaStream, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=pcm',
        recorderType: StereoAudioRecorder,
        timeSlice: 250, // Send audio chunks every 250ms
        desiredSampRate: 16000, // 16kHz sample rate required by AssemblyAI
        numberOfAudioChannels: 1, // Mono
        bufferSize: 4096,
        audioBitsPerSecond: 128000,
        ondataavailable: async (blob: Blob) => {
          if (!this.realtimeTranscriber) return;
          // Convert blob to ArrayBuffer and send to AssemblyAI
          const buffer = await blob.arrayBuffer();
          this.realtimeTranscriber.sendAudio(buffer);
        },
      });

      this.recorder.startRecording();
      console.log('🎙️ Recording started');

      this._isRecording = true;
      this.callbacks.onStatusChange?.('recording');
      console.log('✅ AssemblyAI transcription started successfully');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.('error');
      this.callbacks.onError?.(error as Error);
      // Clean up on error
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop transcription
   */
  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping transcription...');
    this._isRecording = false;

    // Stop and clean up recorder
    if (this.recorder) {
      console.log('🎤 Stopping recorder...');
      this.recorder.stopRecording(() => {
        console.log('✅ Recorder stopped');
      });
      this.recorder.destroy();
      this.recorder = null;
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
        console.log('🛑 Stopping track:', track.kind);
        track.stop();
      });
      this.mediaStream = null;
    }

    // Close WebSocket connection
    if (this.realtimeTranscriber) {
      console.log('🔌 Closing WebSocket...');
      try {
        await this.realtimeTranscriber.close();
        console.log('✅ WebSocket closed');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.realtimeTranscriber = null;
    }

    // Reset state
    this.interimTexts = {};
    this.callbacks.onStatusChange?.('idle');
    console.log('✅ Transcription stopped successfully');
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
  settings: SmartVersesSettings,
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
