/**
 * TRANSCRIPTION FUNCTIONS
 * 
 * Complete implementation of live transcription using AssemblyAI Realtime API.
 * These functions handle audio capture, real-time transcription, and transcript processing.
 * 
 * Note: This is TypeScript/React code. Adapt as needed for your framework.
 */

import { RealtimeTranscriber } from 'assemblyai/streaming';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TranscriptionSegment {
  id: number;
  text: string;
  timestamp: number;
}

interface TranscriptionCallbacks {
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  onConnectionClose?: (code: number, reason: string) => void;
}

// ============================================================================
// TRANSCRIPTION CLASS
// ============================================================================

export class LiveTranscriptionService {
  private realtimeTranscriber: RealtimeTranscriber | null = null;
  private recorder: RecordRTC | null = null;
  private isRecording: boolean = false;
  private selectedMic: string = '';
  private callbacks: TranscriptionCallbacks = {};

  /**
   * Initialize transcription service
   * 
   * @param callbacks - Callback functions for transcript events
   */
  constructor(callbacks: TranscriptionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Get available microphone devices
   * 
   * @returns Promise resolving to array of media device info
   */
  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting microphone devices:', error);
      return [];
    }
  }

  /**
   * Set the selected microphone device
   * 
   * @param deviceId - Microphone device ID
   */
  setMicrophone(deviceId: string): void {
    this.selectedMic = deviceId;
  }

  /**
   * Start live transcription
   * 
   * @param token - AssemblyAI temporary token (get from your backend)
   * @returns Promise that resolves when transcription starts
   */
  async startTranscription(token: string): Promise<void> {
    try {
      // Clean up any existing connections
      if (this.realtimeTranscriber) {
        await this.realtimeTranscriber.close();
        this.realtimeTranscriber = null;
      }

      if (this.recorder) {
        this.recorder.destroy();
        this.recorder = null;
      }

      // Initialize RealtimeTranscriber
      this.realtimeTranscriber = new RealtimeTranscriber({
        token: token,
        sampleRate: 16000,
      });

      // Set up event handlers
      this.setupTranscriptionHandlers();

      // Connect to AssemblyAI
      await this.realtimeTranscriber.connect();

      // Get microphone access and start recording
      await this.startAudioCapture();

      this.isRecording = true;
      console.log('✅ Transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Set up transcription event handlers
   */
  private setupTranscriptionHandlers(): void {
    if (!this.realtimeTranscriber) return;

    const texts: { [key: number]: string } = {};

    // Handle interim transcripts (live updates)
    this.realtimeTranscriber.on('transcript', (data: any) => {
      texts[data.audio_start] = data.text;
      const keys = Object.keys(texts)
        .map(Number)
        .sort((a, b) => a - b);
      const msg = keys.map((key) => texts[key]).join(' ');
      const trimmedMsg = msg.trim();
      
      // Call interim transcript callback
      this.callbacks.onInterimTranscript?.(trimmedMsg);
    });

    // Handle final transcripts (complete sentences)
    this.realtimeTranscriber.on('transcript.final', async (finalData: any) => {
      console.log('Final transcript:', finalData.text);

      // Call final transcript callback
      this.callbacks.onFinalTranscript?.(finalData.text);

      // Clear interim texts
      for (const key in texts) {
        delete texts[key];
      }
    });

    // Handle errors
    this.realtimeTranscriber.on('error', (event: any) => {
      console.error('❌ Transcription error:', event);
      this.cleanup();
      this.callbacks.onError?.(new Error(event.message || 'Transcription error'));
    });

    // Handle connection close
    this.realtimeTranscriber.on('close', (code: number, reason: string) => {
      console.log(`🔌 Connection closed: ${code} ${reason}`);
      this.realtimeTranscriber = null;
      this.callbacks.onConnectionClose?.(code, reason);
    });
  }

  /**
   * Start audio capture from microphone
   */
  private async startAudioCapture(): Promise<void> {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: this.selectedMic ? { deviceId: { exact: this.selectedMic } } : true,
      });

      // Initialize RecordRTC
      this.recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=pcm',
        recorderType: StereoAudioRecorder,
        timeSlice: 250,                    // Send audio chunks every 250ms
        desiredSampRate: 16000,            // 16kHz sample rate
        numberOfAudioChannels: 1,          // Mono
        bufferSize: 4096,
        audioBitsPerSecond: 128000,
        workerPath: false,
        ondataavailable: async (blob: Blob) => {
          if (!this.realtimeTranscriber) return;
          
          // Convert blob to ArrayBuffer and send to AssemblyAI
          const buffer = await blob.arrayBuffer();
          this.realtimeTranscriber.sendAudio(buffer);
        },
      });

      // Start recording
      this.recorder.startRecording();
      console.log('🎤 Audio capture started');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  /**
   * Stop transcription
   */
  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping transcription...');

    this.isRecording = false;

    // Stop recorder
    if (this.recorder) {
      this.recorder.stopRecording(() => {
        console.log('✅ Recorder stopped');
      });

      // Stop all media stream tracks
      const stream = this.recorder.stream;
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          console.log('🛑 Stopping track:', track.kind);
          track.stop();
        });
      }

      this.recorder.destroy();
      this.recorder = null;
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

    console.log('✅ Transcription cleanup complete');
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isRecording = false;

    if (this.recorder) {
      const stream = this.recorder.stream;
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      this.recorder.destroy();
      this.recorder = null;
    }

    if (this.realtimeTranscriber) {
      this.realtimeTranscriber.close().catch((err: any) =>
        console.error('Error closing transcriber:', err)
      );
      this.realtimeTranscriber = null;
    }
  }
}

// ============================================================================
// BACKEND TOKEN GENERATION (Node.js/Electron)
// ============================================================================

/**
 * Initialize transcription IPC handlers (for Electron apps)
 * This should be called in your main process
 * 
 * @param ipcMain - Electron IPC main handler
 */
export function initializeTranscriptionIpc(ipcMain: any): void {
  const { AssemblyAI } = require('assemblyai');
  const dotenv = require('dotenv');
  
  dotenv.config();
  
  const aaiClient = new AssemblyAI({ 
    apiKey: process.env.ASSEMBLYAI_API_KEY 
  });

  ipcMain.handle('transcription:getToken', async () => {
    try {
      const token = await aaiClient.realtime.createTemporaryToken({
        expires_in: 3600, // 1 hour
      });
      return { token };
    } catch (error: any) {
      console.error('Error retrieving token:', error);
      throw new Error(error.message || 'Failed to retrieve token');
    }
  });
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Basic usage
const transcription = new LiveTranscriptionService({
  onInterimTranscript: (text) => {
    console.log('Interim:', text);
  },
  onFinalTranscript: (text) => {
    console.log('Final:', text);
    // Process final transcript for Bible references here
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});

// Get token from backend
const tokenResponse = await fetch('/api/transcription/token');
const { token } = await tokenResponse.json();

// Start transcription
await transcription.startTranscription(token);

// Stop transcription
await transcription.stopTranscription();

// Example 2: With microphone selection
const devices = await transcription.getMicrophoneDevices();
if (devices.length > 0) {
  transcription.setMicrophone(devices[0].deviceId);
}
await transcription.startTranscription(token);
*/
