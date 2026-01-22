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

import { RealtimeTranscriber } from "assemblyai/streaming";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";
import { getAssemblyAITemporaryToken } from "./assemblyaiTokenService";
import {
  TranscriptionEngine,
  TranscriptionCallbacks,
  TranscriptionSegment,
  SmartVersesSettings,
  SMART_VERSES_SETTINGS_KEY,
  DEFAULT_SMART_VERSES_SETTINGS,
} from "../types/smartVerses";

type NativeAudioInputDevice = {
  id: string;
  name: string;
  is_default: boolean;
};

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
  setAudioCaptureMode?(mode: "webrtc" | "native"): void;
  setNativeMicrophoneDeviceId?(deviceId: string | null): void;
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
  readonly engine: TranscriptionEngine = "assemblyai";

  private apiKey: string = "";
  private realtimeTranscriber: RealtimeTranscriber | null = null;
  private recorder: RecordRTC | null = null;
  private mediaStream: MediaStream | null = null; // Store stream reference separately
  private selectedMicId: string = "";
  private audioCaptureMode: "webrtc" | "native" = "webrtc";
  private selectedNativeDeviceId: string | null = null;
  private nativeUnlisten: null | (() => void) = null;
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

  setAudioCaptureMode(mode: "webrtc" | "native"): void {
    this.audioCaptureMode = mode;
  }

  setNativeMicrophoneDeviceId(deviceId: string | null): void {
    this.selectedNativeDeviceId = deviceId;
  }

  async getNativeMicrophoneDevices(): Promise<NativeAudioInputDevice[]> {
    try {
      const mod = await import("@tauri-apps/api/core");
      return await mod.invoke<NativeAudioInputDevice[]>(
        "list_native_audio_input_devices"
      );
    } catch {
      return [];
    }
  }

  /**
   * Get available microphone devices
   */
  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // Request permission first to get full device list with labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Immediately stop the stream to release the microphone
      stream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      console.log(
        `Found ${audioInputs.length} audio input devices:`,
        audioInputs.map((d) => d.label || d.deviceId)
      );
      return audioInputs;
    } catch (error) {
      console.error("Error getting microphone devices:", error);
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
      console.log("🔑 Requesting temporary token from AssemblyAI...");
      const token = await getAssemblyAITemporaryToken(this.apiKey, 3600);
      console.log("✅ Token received successfully");
      return token;
    } catch (error) {
      console.error("Error getting AssemblyAI token:", error);
      throw error;
    }
  }

  /**
   * Clean up existing connections and recorder
   */
  private async cleanup(): Promise<void> {
    // Stop native capture if active
    await this.stopNativeAudioCapture();

    // Clean up existing transcriber
    if (this.realtimeTranscriber) {
      console.log("⚠️ Existing transcriber found, cleaning up...");
      try {
        await this.realtimeTranscriber.close();
      } catch (error) {
        console.error("Error closing existing transcriber:", error);
      }
      this.realtimeTranscriber = null;
    }

    // Clean up existing recorder and stream
    if (this.recorder) {
      console.log("⚠️ Existing recorder found, cleaning up...");
      this.recorder.destroy();
      this.recorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
      this.mediaStream = null;
    }
  }

  private async stopNativeAudioCapture(): Promise<void> {
    if (!this.nativeUnlisten) return;

    try {
      const core = await import("@tauri-apps/api/core");
      await core.invoke("stop_native_audio_stream");
    } catch {
      // ignore
    }

    try {
      this.nativeUnlisten();
    } catch {
      // ignore
    }
    this.nativeUnlisten = null;
  }

  /**
   * Start live transcription
   */
  async startTranscription(): Promise<void> {
    if (this._isRecording) {
      console.warn("Transcription already in progress");
      return;
    }

    if (!this.apiKey) {
      throw new Error("AssemblyAI API key not configured");
    }

    this.callbacks.onStatusChange?.("connecting");

    try {
      // Clean up any existing connections
      await this.cleanup();

      console.log("🎬 Creating new RealtimeTranscriber...");

      // Get temporary token
      const token = await this.getTemporaryToken();

      // Initialize RealtimeTranscriber with the AssemblyAI SDK
      this.realtimeTranscriber = new RealtimeTranscriber({
        token,
        sampleRate: 16000, // Required: 16kHz sample rate
      });

      // Handle interim transcripts (live updates)
      this.realtimeTranscriber.on(
        "transcript",
        (data: { audio_start: number; text: string }) => {
          this.interimTexts[data.audio_start] = data.text;
          const keys = Object.keys(this.interimTexts)
            .map(Number)
            .sort((a, b) => a - b);
          const combinedText = keys
            .map((key) => this.interimTexts[key])
            .join(" ")
            .trim();
          this.callbacks.onInterimTranscript?.(combinedText);
        }
      );

      // Handle final transcripts (complete sentences)
      this.realtimeTranscriber.on(
        "transcript.final",
        (finalData: { text: string }) => {
          console.log("📝 Final transcript:", finalData.text);

          const segment: TranscriptionSegment = {
            id: `segment-${++this.segmentCounter}`,
            text: finalData.text,
            timestamp: Date.now(),
            isFinal: true,
          };

          this.callbacks.onFinalTranscript?.(finalData.text, segment);

          // Clear interim texts
          this.interimTexts = {};
        }
      );

      // Handle errors
      this.realtimeTranscriber.on("error", (event: { message?: string }) => {
        console.error("❌ Transcription error:", event);
        this.callbacks.onError?.(
          new Error(event.message || "Transcription error")
        );
        this.stopTranscription();
      });

      // Handle connection close
      this.realtimeTranscriber.on("close", (code: number, reason: string) => {
        console.log(`🔌 Connection closed: ${code} ${reason}`);
        this._isRecording = false;
        // Make sure we don't leave native capture running if the socket closes
        this.stopNativeAudioCapture().catch(() => {});
        this.callbacks.onConnectionClose?.(code, reason);
        this.callbacks.onStatusChange?.("idle");
      });

      // Connect to AssemblyAI
      console.log("🔌 Connecting to AssemblyAI WebSocket...");
      await this.realtimeTranscriber.connect();
      console.log("✅ WebSocket connected");

      if (this.audioCaptureMode === "native") {
        console.log(
          "🎛️ Using native audio capture (cpal) via Tauri backend..."
        );

        // Subscribe to native PCM chunks
        const events = await import("@tauri-apps/api/event");
        const core = await import("@tauri-apps/api/core");

        const base64ToUint8Array = (b64: string): Uint8Array => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return bytes;
        };

        const unlisten = await events.listen<{ data_b64: string }>(
          "native_audio_chunk",
          (evt) => {
            if (!this.realtimeTranscriber) return;
            try {
              const bytes = base64ToUint8Array(evt.payload.data_b64);
              // sendAudio accepts ArrayBuffer/TypedArray; use bytes.buffer slice to avoid extra copy
              const buf = bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
              );
              this.realtimeTranscriber.sendAudio(buf);
            } catch (e) {
              // keep going; transient decode errors shouldn't kill transcription
            }
          }
        );

        this.nativeUnlisten = unlisten;

        await core.invoke("start_native_audio_stream", {
          deviceId: this.selectedNativeDeviceId ?? undefined,
        });

        console.log("🎙️ Native recording started");
      } else {
        // Get microphone access and start recording (WebRTC/WebView)
        const constraints: MediaStreamConstraints = {
          audio: this.selectedMicId
            ? { deviceId: { exact: this.selectedMicId } }
            : true,
        };

        console.log("🎤 Requesting microphone access...");
        this.mediaStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        console.log("✅ Microphone access granted");

        // Initialize RecordRTC with the correct settings
        this.recorder = new RecordRTC(this.mediaStream, {
          type: "audio",
          mimeType: "audio/webm;codecs=pcm",
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
        console.log("🎙️ Recording started");
      }

      this._isRecording = true;
      this.callbacks.onStatusChange?.("recording");
      console.log("✅ AssemblyAI transcription started successfully");
    } catch (error) {
      console.error("Failed to start transcription:", error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.("error");
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
    console.log("🛑 Stopping transcription...");
    this._isRecording = false;

    // Stop native audio capture (if used)
    await this.stopNativeAudioCapture();

    // Stop and clean up recorder
    if (this.recorder) {
      console.log("🎤 Stopping recorder...");
      this.recorder.stopRecording(() => {
        console.log("✅ Recorder stopped");
      });
      this.recorder.destroy();
      this.recorder = null;
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
        console.log("🛑 Stopping track:", track.kind);
        track.stop();
      });
      this.mediaStream = null;
    }

    // Close WebSocket connection
    if (this.realtimeTranscriber) {
      console.log("🔌 Closing WebSocket...");
      try {
        await this.realtimeTranscriber.close();
        console.log("✅ WebSocket closed");
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      }
      this.realtimeTranscriber = null;
    }

    // Reset state
    this.interimTexts = {};
    this.callbacks.onStatusChange?.("idle");
    console.log("✅ Transcription stopped successfully");
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopTranscription();
  }
}

// =============================================================================
// GROQ TRANSCRIPTION SERVICE
// =============================================================================

/**
 * Groq Whisper Transcription Service
 *
 * Uses Groq's high-speed Whisper API for near real-time transcription.
 * Since Groq doesn't support WebSocket streaming, we record audio in small chunks (e.g. 3s),
 * send them to the REST API, and stream the results.
 */
export class GroqTranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = "groq";

  private apiKey: string = "";
  private model: string = "whisper-large-v3";
  private recorder: RecordRTC | null = null;
  private mediaStream: MediaStream | null = null;
  private selectedMicId: string = "";
  private audioCaptureMode: "webrtc" | "native" = "webrtc";
  private selectedNativeDeviceId: string | null = null;
  private nativeUnlisten: null | (() => void) = null;
  private callbacks: TranscriptionCallbacks = {};
  private _isRecording: boolean = false;
  private segmentCounter: number = 0;
  private chunkInterval: NodeJS.Timeout | null = null;
  private nativeBuffer: Float32Array = new Float32Array(0);
  private readonly SAMPLE_RATE = 16000;
  private readonly CHUNK_DURATION_MS = 3000; // 3 seconds chunks

  constructor(
    apiKey: string,
    model: string,
    callbacks: TranscriptionCallbacks = {}
  ) {
    this.apiKey = apiKey;
    this.model = model || "whisper-large-v3";
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setCallbacks(callbacks: TranscriptionCallbacks): void {
    this.callbacks = callbacks;
  }

  setAudioCaptureMode(mode: "webrtc" | "native"): void {
    this.audioCaptureMode = mode;
  }

  setNativeMicrophoneDeviceId(deviceId: string | null): void {
    this.selectedNativeDeviceId = deviceId;
  }

  async getNativeMicrophoneDevices(): Promise<NativeAudioInputDevice[]> {
    try {
      const mod = await import("@tauri-apps/api/core");
      return await mod.invoke<NativeAudioInputDevice[]>(
        "list_native_audio_input_devices"
      );
    } catch {
      return [];
    }
  }

  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "audioinput");
    } catch (error) {
      console.error("Error getting microphone devices:", error);
      return [];
    }
  }

  setMicrophone(deviceId: string): void {
    this.selectedMicId = deviceId;
  }

  private async cleanup(): Promise<void> {
    await this.stopNativeAudioCapture();

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.recorder) {
      this.recorder.destroy();
      this.recorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.nativeBuffer = new Float32Array(0);
  }

  private async stopNativeAudioCapture(): Promise<void> {
    if (!this.nativeUnlisten) return;
    try {
      const core = await import("@tauri-apps/api/core");
      await core.invoke("stop_native_audio_stream");
    } catch {}
    try {
      this.nativeUnlisten();
    } catch {}
    this.nativeUnlisten = null;
  }

  async startTranscription(): Promise<void> {
    if (this._isRecording) return;
    if (!this.apiKey) throw new Error("Groq API key not configured");

    this.callbacks.onStatusChange?.("connecting");

    try {
      await this.cleanup();

      if (this.audioCaptureMode === "native") {
        await this.startNativeCapture();
      } else {
        await this.startWebRTCCapture();
      }

      this._isRecording = true;
      this.callbacks.onStatusChange?.("recording");
      console.log("✅ Groq transcription started");

      // Start processing loop
      this.chunkInterval = setInterval(() => {
        this.processAudioChunk();
      }, this.CHUNK_DURATION_MS);
    } catch (error) {
      console.error("Failed to start transcription:", error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.("error");
      this.callbacks.onError?.(error as Error);
      await this.cleanup();
      throw error;
    }
  }

  private async startWebRTCCapture() {
    const constraints: MediaStreamConstraints = {
      audio: this.selectedMicId
        ? { deviceId: { exact: this.selectedMicId } }
        : true,
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // We use StereoAudioRecorder to get WAV blobs directly if possible, 
    // but RecordRTC's internal loop is better managed manually for chunking.
    // Actually, for Groq we need a file (Blob). 
    // We will restart the recorder every chunk interval to get a clean blob.
    this.recorder = new RecordRTC(this.mediaStream, {
      type: "audio",
      mimeType: "audio/wav",
      recorderType: StereoAudioRecorder,
      numberOfAudioChannels: 1,
      desiredSampRate: 16000,
    });

    this.recorder.startRecording();
  }

  private async startNativeCapture() {
    console.log("🎛️ Using native audio capture for Groq...");
    const events = await import("@tauri-apps/api/event");
    const core = await import("@tauri-apps/api/core");

    const base64ToFloat32Array = (b64: string): Float32Array => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // Convert PCM 16-bit (bytes) to Float32 (-1.0 to 1.0)
      const int16View = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32[i] = int16View[i] / 32768.0;
      }
      return float32;
    };

    const unlisten = await events.listen<{ data_b64: string }>(
      "native_audio_chunk",
      (evt) => {
        try {
          const newSamples = base64ToFloat32Array(evt.payload.data_b64);
          // Append to buffer
          const tmp = new Float32Array(this.nativeBuffer.length + newSamples.length);
          tmp.set(this.nativeBuffer);
          tmp.set(newSamples, this.nativeBuffer.length);
          this.nativeBuffer = tmp;
        } catch (e) {
          console.error("Error processing native audio chunk:", e);
        }
      }
    );

    this.nativeUnlisten = unlisten;
    await core.invoke("start_native_audio_stream", {
      deviceId: this.selectedNativeDeviceId ?? undefined,
    });
  }

  private async processAudioChunk() {
    if (!this._isRecording) return;

    let audioBlob: Blob | null = null;

    if (this.audioCaptureMode === "native") {
      // Process native buffer
      if (this.nativeBuffer.length === 0) return;
      
      // Create WAV from buffer
      audioBlob = createWavFile(this.nativeBuffer, this.SAMPLE_RATE);
      
      // Clear buffer (keep overlap if needed? for now clear all)
      this.nativeBuffer = new Float32Array(0);
    } else {
      // Process WebRTC recorder
      if (!this.recorder) return;

      // Stop and get blob
      await new Promise<void>((resolve) => {
        this.recorder?.stopRecording(() => {
          audioBlob = this.recorder?.getBlob() || null;
          resolve();
        });
      });

      // Restart recording immediately
      if (this._isRecording && this.mediaStream?.active) {
        this.recorder.destroy();
        this.recorder = new RecordRTC(this.mediaStream, {
          type: "audio",
          mimeType: "audio/wav",
          recorderType: StereoAudioRecorder,
          numberOfAudioChannels: 1,
          desiredSampRate: 16000,
        });
        this.recorder.startRecording();
      }
    }

    if (audioBlob && audioBlob.size > 0) {
      this.sendToGroq(audioBlob);
    }
  }

  private async sendToGroq(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.wav");
      formData.append("model", this.model);
      // Optional: prompt to provide context from previous segments?
      // formData.append("prompt", "previous transcript context..."); 

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API error:", errText);
        return;
      }

      const data = await response.json();
      const text = data.text?.trim();

      if (text) {
        console.log("📝 Groq Transcript:", text);
        const segment: TranscriptionSegment = {
          id: `segment-${++this.segmentCounter}`,
          text: text,
          timestamp: Date.now(),
          isFinal: true,
        };
        this.callbacks.onFinalTranscript?.(text, segment);
      }
    } catch (error) {
      console.error("Error sending audio to Groq:", error);
    }
  }

  async stopTranscription(): Promise<void> {
    console.log("🛑 Stopping Groq transcription...");
    this._isRecording = false;
    await this.cleanup();
    this.callbacks.onStatusChange?.("idle");
  }
}

/**
 * Helper to create a WAV file from Float32Array samples
 */
function createWavFile(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 for Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// =============================================================================
// OFFLINE WHISPER TRANSCRIPTION SERVICE
// =============================================================================

const WHISPER_SAMPLING_RATE = 16000;
const MAX_AUDIO_LENGTH = 30; // seconds
const MAX_SAMPLES = WHISPER_SAMPLING_RATE * MAX_AUDIO_LENGTH;

/**
 * Offline Whisper Transcription Service
 *
 * Uses @huggingface/transformers with a Web Worker for offline transcription.
 * Processes audio in chunks and sends to the worker for inference.
 */
export class OfflineWhisperTranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = "offline-whisper";

  private worker: Worker | null = null;
  private modelId: string;
  private language: string;
  private callbacks: TranscriptionCallbacks = {};
  private _isRecording: boolean = false;
  private isModelReady: boolean = false;
  private segmentCounter: number = 0;

  // Audio capture
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private selectedMicId: string = "";
  private audioCaptureMode: "webrtc" | "native" = "webrtc";
  private selectedNativeDeviceId: string | null = null;
  private nativeUnlisten: null | (() => void) = null;
  private nativeBuffer: Float32Array = new Float32Array(0);
  private rollingAudioBuffer: Float32Array = new Float32Array(0);
  private hasPendingAudio: boolean = false;
  private isProcessing: boolean = false;
  private decodeQueue: Promise<void> = Promise.resolve();
  private recorderRequestTimeout: ReturnType<typeof setTimeout> | null = null;
  private accumulatedInterimText: string = ""; // Track accumulated interim text for current session
  private lastProcessedBufferLength: number = 0; // Track how much audio was in the buffer when we last processed it
  private readonly CONTEXT_OVERLAP_SAMPLES = WHISPER_SAMPLING_RATE * 3; // Keep last 3 seconds (in samples) for context

  constructor(
    modelId: string,
    language: string = "en",
    callbacks: TranscriptionCallbacks = {}
  ) {
    this.modelId = modelId || "onnx-community/whisper-base";
    this.language = language;
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  setModelId(modelId: string): void {
    this.modelId = modelId;
  }

  setLanguage(language: string): void {
    this.language = language;
  }

  setCallbacks(callbacks: TranscriptionCallbacks): void {
    this.callbacks = callbacks;
  }

  setAudioCaptureMode(mode: "webrtc" | "native"): void {
    this.audioCaptureMode = mode;
  }

  setNativeMicrophoneDeviceId(deviceId: string | null): void {
    this.selectedNativeDeviceId = deviceId;
  }

  async getNativeMicrophoneDevices(): Promise<NativeAudioInputDevice[]> {
    try {
      const mod = await import("@tauri-apps/api/core");
      return await mod.invoke<NativeAudioInputDevice[]>(
        "list_native_audio_input_devices"
      );
    } catch {
      return [];
    }
  }

  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "audioinput");
    } catch (error) {
      console.error("Error getting microphone devices:", error);
      return [];
    }
  }

  setMicrophone(deviceId: string): void {
    this.selectedMicId = deviceId;
  }

  private initWorker(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL("../workers/whisperWorker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.addEventListener("message", (event) => {
      const { type, message, text, output, file, progress } = event.data;

      switch (type) {
        case "loading":
          console.log("📦 Whisper:", message);
          this.callbacks.onStatusChange?.("connecting");
          break;

        case "info":
          console.log("ℹ️ Whisper:", message);
          break;

        case "progress":
          console.log(`📥 ${file}: ${progress?.toFixed(1)}%`);
          break;

        case "ready":
          console.log("✅ Whisper model ready");
          this.isModelReady = true;
          if (this._isRecording) {
            this.callbacks.onStatusChange?.("recording");
            if (this.audioCaptureMode === "webrtc") {
              this.requestRecorderData(0);
              this.maybeProcessWebRTCAudio();
            } else {
              this.maybeProcessNativeAudio();
            }
          }
          break;

        case "start":
          console.log("🎙️ Whisper processing...");
          this.isProcessing = true;
          // Reset accumulated text for new transcription chunk
          this.accumulatedInterimText = "";
          if (this.audioCaptureMode === "webrtc") {
            this.requestRecorderData(0);
          }
          break;

        case "update":
          // Streaming update - output now contains only the new chunk
          if (output) {
            // Accumulate the new chunk
            this.accumulatedInterimText += (this.accumulatedInterimText ? " " : "") + output;
            // Send the full accumulated text to maintain compatibility
            this.callbacks.onInterimTranscript?.(this.accumulatedInterimText);
          }
          break;

        case "complete":
          this.isProcessing = false;
          if (text) {
            console.log("📝 Whisper transcript:", text);
            const segment: TranscriptionSegment = {
              id: `segment-${++this.segmentCounter}`,
              text: text,
              timestamp: Date.now(),
              isFinal: true,
            };
            // Clear accumulated interim text when final transcript arrives
            this.accumulatedInterimText = "";
            this.callbacks.onFinalTranscript?.(text, segment);
            
            // Clear processed audio from buffer, keeping only context overlap
            // This prevents re-transcribing the same audio in the next segment
            this.clearProcessedAudio();
          }
          if (this.audioCaptureMode === "webrtc") {
            this.maybeProcessWebRTCAudio();
          } else {
            this.maybeProcessNativeAudio();
          }
          break;

        case "error":
          console.error("❌ Whisper error:", message);
          this.isProcessing = false;
          this.callbacks.onError?.(new Error(message));
          break;
      }
    });

    this.worker.addEventListener("error", (error) => {
      console.error("Worker error:", error);
      this.callbacks.onError?.(new Error(error.message));
    });
  }

  private async cleanup(): Promise<void> {
    await this.stopNativeAudioCapture();

    if (this.recorderRequestTimeout) {
      clearTimeout(this.recorderRequestTimeout);
      this.recorderRequestTimeout = null;
    }

    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.nativeBuffer = new Float32Array(0);
    this.rollingAudioBuffer = new Float32Array(0);
    this.hasPendingAudio = false;
    this.isProcessing = false;
    this.decodeQueue = Promise.resolve();
    this.accumulatedInterimText = "";
    this.lastProcessedBufferLength = 0;
  }

  private async stopNativeAudioCapture(): Promise<void> {
    if (!this.nativeUnlisten) return;
    try {
      const core = await import("@tauri-apps/api/core");
      await core.invoke("stop_native_audio_stream");
    } catch {}
    try {
      this.nativeUnlisten();
    } catch {}
    this.nativeUnlisten = null;
  }

  async startTranscription(): Promise<void> {
    if (this._isRecording) return;

    this.callbacks.onStatusChange?.("connecting");

    try {
      await this.cleanup();

      // Initialize worker and load model
      this.initWorker();
      this.worker!.postMessage({
        type: "load",
        data: { modelId: this.modelId },
      });

      // Set up audio capture
      if (this.audioCaptureMode === "native") {
        await this.startNativeCapture();
      } else {
        await this.startWebRTCCapture();
      }

      this._isRecording = true;
      console.log("✅ Offline Whisper transcription started");

    } catch (error) {
      console.error("Failed to start offline Whisper transcription:", error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.("error");
      this.callbacks.onError?.(error as Error);
      await this.cleanup();
      throw error;
    }
  }

  private async startWebRTCCapture(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: this.selectedMicId
        ? { deviceId: { exact: this.selectedMicId } }
        : true,
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioContext = new AudioContext({
      sampleRate: WHISPER_SAMPLING_RATE,
    });

    this.mediaRecorder = new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.enqueueWebRTCAudioChunk(e.data);
      } else {
        this.requestRecorderData(25);
      }
    };

    this.mediaRecorder.start();
    this.requestRecorderData(0);
  }

  private requestRecorderData(delayMs: number): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
    if (this.recorderRequestTimeout) return;
    this.recorderRequestTimeout = setTimeout(() => {
      this.recorderRequestTimeout = null;
      try {
        this.mediaRecorder?.requestData();
      } catch {
        // Ignore transient request errors when recorder stops.
      }
    }, delayMs);
  }

  private enqueueWebRTCAudioChunk(blob: Blob): void {
    this.decodeQueue = this.decodeQueue.then(async () => {
      if (!this.audioContext || !this._isRecording) return;
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await this.audioContext.decodeAudioData(arrayBuffer);
        this.appendToRollingBuffer(decoded.getChannelData(0));
        this.hasPendingAudio = true;
        this.maybeProcessWebRTCAudio();
      } catch (error) {
        console.error("Error decoding Whisper audio chunk:", error);
      }
    });
  }

  private appendToRollingBuffer(samples: Float32Array): void {
    if (samples.length === 0) return;
    const combined = new Float32Array(this.rollingAudioBuffer.length + samples.length);
    combined.set(this.rollingAudioBuffer);
    combined.set(samples, this.rollingAudioBuffer.length);
    this.rollingAudioBuffer =
      combined.length > MAX_SAMPLES ? combined.slice(-MAX_SAMPLES) : combined;
  }

  /**
   * Clear processed audio from the buffer, keeping only a small context overlap.
   * This prevents re-transcribing the same audio in subsequent segments.
   */
  private clearProcessedAudio(): void {
    if (this.rollingAudioBuffer.length === 0) return;
    
    // Calculate how much audio to keep for context
    // We want to keep the last CONTEXT_OVERLAP_SECONDS of audio
    const samplesToKeep = Math.min(
      this.CONTEXT_OVERLAP_SAMPLES,
      this.rollingAudioBuffer.length
    );
    
    // Keep only the last N seconds for context
    this.rollingAudioBuffer = this.rollingAudioBuffer.slice(-samplesToKeep);
    // Set the processed length to the size of the remaining buffer
    // This way we know the entire remaining buffer is context, not new audio
    this.lastProcessedBufferLength = this.rollingAudioBuffer.length;
    
    console.log(`🧹 Cleared processed audio, kept ${samplesToKeep} samples (${(samplesToKeep / WHISPER_SAMPLING_RATE).toFixed(1)}s) for context`);
  }

  private maybeProcessWebRTCAudio(): void {
    if (this.audioCaptureMode !== "webrtc") return;
    if (!this._isRecording || !this.isModelReady || this.isProcessing) return;
    if (!this.hasPendingAudio || this.rollingAudioBuffer.length === 0) return;

    // Only process if we have new audio beyond what we've already processed
    // We need at least a few seconds of new audio to make it worth processing
    const MIN_NEW_AUDIO_SECONDS = 2;
    const MIN_NEW_AUDIO_SAMPLES = WHISPER_SAMPLING_RATE * MIN_NEW_AUDIO_SECONDS;
    
    const newAudioLength = this.rollingAudioBuffer.length - this.lastProcessedBufferLength;
    
    if (newAudioLength < MIN_NEW_AUDIO_SAMPLES) {
      // Not enough new audio yet, wait for more
      return;
    }

    this.hasPendingAudio = false;
    this.isProcessing = true;
    this.lastProcessedBufferLength = this.rollingAudioBuffer.length;
    
    this.worker?.postMessage({
      type: "transcribe",
      data: { audio: this.rollingAudioBuffer, language: this.language },
    });
  }

  private async startNativeCapture(): Promise<void> {
    console.log("🎛️ Using native audio capture for offline Whisper...");
    const events = await import("@tauri-apps/api/event");
    const core = await import("@tauri-apps/api/core");

    const base64ToFloat32Array = (b64: string): Float32Array => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const int16View = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32[i] = int16View[i] / 32768.0;
      }
      return float32;
    };

    const unlisten = await events.listen<{ data_b64: string }>(
      "native_audio_chunk",
      (evt) => {
        try {
          const newSamples = base64ToFloat32Array(evt.payload.data_b64);
          const tmp = new Float32Array(this.nativeBuffer.length + newSamples.length);
          tmp.set(this.nativeBuffer);
          tmp.set(newSamples, this.nativeBuffer.length);
          this.nativeBuffer = tmp;
          this.hasPendingAudio = true;
          this.maybeProcessNativeAudio();
        } catch (e) {
          console.error("Error processing native audio chunk:", e);
        }
      }
    );

    this.nativeUnlisten = unlisten;
    await core.invoke("start_native_audio_stream", {
      deviceId: this.selectedNativeDeviceId ?? undefined,
    });
  }

  private maybeProcessNativeAudio(): void {
    if (this.audioCaptureMode !== "native") return;
    if (!this._isRecording || !this.isModelReady || this.isProcessing) return;
    if (!this.hasPendingAudio || this.nativeBuffer.length === 0) return;

    this.appendToRollingBuffer(this.nativeBuffer);
    this.nativeBuffer = new Float32Array(0);
    
    // Only process if we have new audio beyond what we've already processed
    const MIN_NEW_AUDIO_SECONDS = 2;
    const MIN_NEW_AUDIO_SAMPLES = WHISPER_SAMPLING_RATE * MIN_NEW_AUDIO_SECONDS;
    
    const newAudioLength = this.rollingAudioBuffer.length - this.lastProcessedBufferLength;
    
    if (newAudioLength < MIN_NEW_AUDIO_SAMPLES) {
      // Not enough new audio yet, wait for more
      this.hasPendingAudio = true; // Keep flag set so we check again when more audio arrives
      return;
    }

    this.hasPendingAudio = false;
    this.isProcessing = true;
    this.lastProcessedBufferLength = this.rollingAudioBuffer.length;

    this.worker?.postMessage({
      type: "transcribe",
      data: { audio: this.rollingAudioBuffer, language: this.language },
    });
  }

  async stopTranscription(): Promise<void> {
    console.log("🛑 Stopping offline Whisper transcription...");
    this._isRecording = false;
    await this.cleanup();
    this.callbacks.onStatusChange?.("idle");
  }

  destroy(): void {
    this.stopTranscription();
    if (this.worker) {
      this.worker.postMessage({ type: "unload" });
      this.worker.terminate();
      this.worker = null;
    }
    this.isModelReady = false;
  }
}

// =============================================================================
// OFFLINE MOONSHINE TRANSCRIPTION SERVICE
// =============================================================================

/**
 * Offline Moonshine Transcription Service
 *
 * Uses @huggingface/transformers with a Web Worker for offline transcription.
 * Includes Voice Activity Detection (VAD) for automatic speech segmentation.
 */
export class OfflineMoonshineTranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = "offline-moonshine";

  private worker: Worker | null = null;
  private modelId: string;
  private callbacks: TranscriptionCallbacks = {};
  private _isRecording: boolean = false;
  private isModelReady: boolean = false;
  private segmentCounter: number = 0;

  // Audio capture
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private selectedMicId: string = "";
  private audioCaptureMode: "webrtc" | "native" = "webrtc";
  private selectedNativeDeviceId: string | null = null;
  private nativeUnlisten: null | (() => void) = null;
  
  private readonly SAMPLE_RATE = 16000;

  constructor(
    modelId: string,
    callbacks: TranscriptionCallbacks = {}
  ) {
    this.modelId = modelId || "onnx-community/moonshine-base-ONNX";
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  setModelId(modelId: string): void {
    this.modelId = modelId;
  }

  setCallbacks(callbacks: TranscriptionCallbacks): void {
    this.callbacks = callbacks;
  }

  setAudioCaptureMode(mode: "webrtc" | "native"): void {
    this.audioCaptureMode = mode;
  }

  setNativeMicrophoneDeviceId(deviceId: string | null): void {
    this.selectedNativeDeviceId = deviceId;
  }

  async getNativeMicrophoneDevices(): Promise<NativeAudioInputDevice[]> {
    try {
      const mod = await import("@tauri-apps/api/core");
      return await mod.invoke<NativeAudioInputDevice[]>(
        "list_native_audio_input_devices"
      );
    } catch {
      return [];
    }
  }

  async getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "audioinput");
    } catch (error) {
      console.error("Error getting microphone devices:", error);
      return [];
    }
  }

  setMicrophone(deviceId: string): void {
    this.selectedMicId = deviceId;
  }

  private initWorker(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL("../workers/moonshineWorker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.addEventListener("message", (event) => {
      const { type, message, text } = event.data;
      const eventStatus = event.data.status as string | undefined;

      switch (type) {
        case "loading":
          console.log("📦 Moonshine:", message);
          this.callbacks.onStatusChange?.("connecting");
          break;

        case "info":
          console.log("ℹ️ Moonshine:", message);
          break;

        case "progress":
          const { file, progress } = event.data;
          console.log(`📥 ${file}: ${progress?.toFixed(1)}%`);
          break;

        case "ready":
          console.log("✅ Moonshine model ready");
          this.isModelReady = true;
          if (this._isRecording) {
            this.callbacks.onStatusChange?.("recording");
          }
          break;

        case "status":
          if (eventStatus === "recording_start") {
            console.log("🎙️ Speech detected");
          } else if (eventStatus === "recording_end") {
            console.log("⏸️ Speech ended, transcribing...");
          }
          break;

        case "output":
        case "complete":
          const transcriptText = text || message;
          if (transcriptText) {
            console.log("📝 Moonshine transcript:", transcriptText);
            const segment: TranscriptionSegment = {
              id: `segment-${++this.segmentCounter}`,
              text: transcriptText,
              timestamp: Date.now(),
              isFinal: true,
            };
            this.callbacks.onFinalTranscript?.(transcriptText, segment);
          }
          break;

        case "error":
          console.error("❌ Moonshine error:", message);
          this.callbacks.onError?.(new Error(message));
          break;
      }
    });

    this.worker.addEventListener("error", (error) => {
      console.error("Worker error:", error);
      this.callbacks.onError?.(new Error(error.message));
    });
  }

  private async cleanup(): Promise<void> {
    await this.stopNativeAudioCapture();

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private async stopNativeAudioCapture(): Promise<void> {
    if (!this.nativeUnlisten) return;
    try {
      const core = await import("@tauri-apps/api/core");
      await core.invoke("stop_native_audio_stream");
    } catch {}
    try {
      this.nativeUnlisten();
    } catch {}
    this.nativeUnlisten = null;
  }

  async startTranscription(): Promise<void> {
    if (this._isRecording) return;

    this.callbacks.onStatusChange?.("connecting");

    try {
      await this.cleanup();

      // Initialize worker and load model
      this.initWorker();
      this.worker!.postMessage({
        type: "load",
        data: { modelId: this.modelId },
      });

      // Set up audio capture
      if (this.audioCaptureMode === "native") {
        await this.startNativeCapture();
      } else {
        await this.startWebRTCCapture();
      }

      this._isRecording = true;
      console.log("✅ Offline Moonshine transcription started");

    } catch (error) {
      console.error("Failed to start offline Moonshine transcription:", error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.("error");
      this.callbacks.onError?.(error as Error);
      await this.cleanup();
      throw error;
    }
  }

  private async startWebRTCCapture(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: this.selectedMicId
        ? {
            deviceId: { exact: this.selectedMicId },
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            sampleRate: this.SAMPLE_RATE,
          }
        : {
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            sampleRate: this.SAMPLE_RATE,
          },
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    this.audioContext = new AudioContext({
      sampleRate: this.SAMPLE_RATE,
      latencyHint: "interactive",
    });

    // Create source node
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Load and connect audio worklet for VAD processing
    // We need to create a simple processor that buffers audio and sends to worker
    await this.audioContext.audioWorklet.addModule(
      this.createVADProcessorBlob()
    );

    this.workletNode = new AudioWorkletNode(this.audioContext, "vad-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
    });

    this.sourceNode.connect(this.workletNode);

    this.workletNode.port.onmessage = (event) => {
      const { buffer } = event.data;
      if (this.worker && this._isRecording && this.isModelReady) {
        this.worker.postMessage({ type: "buffer", data: { buffer } });
      }
    };
  }

  private createVADProcessorBlob(): string {
    const processorCode = `
      const MIN_CHUNK_SIZE = 512;
      let globalPointer = 0;
      let globalBuffer = new Float32Array(MIN_CHUNK_SIZE);

      class VADProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const buffer = inputs[0][0];
          if (!buffer) return true;

          if (buffer.length > MIN_CHUNK_SIZE) {
            this.port.postMessage({ buffer: new Float32Array(buffer) });
          } else {
            const remaining = MIN_CHUNK_SIZE - globalPointer;
            if (buffer.length >= remaining) {
              globalBuffer.set(buffer.subarray(0, remaining), globalPointer);
              this.port.postMessage({ buffer: new Float32Array(globalBuffer) });
              globalBuffer.fill(0);
              globalBuffer.set(buffer.subarray(remaining), 0);
              globalPointer = buffer.length - remaining;
            } else {
              globalBuffer.set(buffer, globalPointer);
              globalPointer += buffer.length;
            }
          }

          return true;
        }
      }

      registerProcessor("vad-processor", VADProcessor);
    `;

    const blob = new Blob([processorCode], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  }

  private async startNativeCapture(): Promise<void> {
    console.log("🎛️ Using native audio capture for offline Moonshine...");
    const events = await import("@tauri-apps/api/event");
    const core = await import("@tauri-apps/api/core");

    const base64ToFloat32Array = (b64: string): Float32Array => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const int16View = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32[i] = int16View[i] / 32768.0;
      }
      return float32;
    };

    const unlisten = await events.listen<{ data_b64: string }>(
      "native_audio_chunk",
      (evt) => {
        if (!this.worker || !this._isRecording || !this.isModelReady) return;
        try {
          const buffer = base64ToFloat32Array(evt.payload.data_b64);
          this.worker.postMessage({ type: "buffer", data: { buffer } });
        } catch (e) {
          console.error("Error processing native audio chunk:", e);
        }
      }
    );

    this.nativeUnlisten = unlisten;
    await core.invoke("start_native_audio_stream", {
      deviceId: this.selectedNativeDeviceId ?? undefined,
    });
  }

  async stopTranscription(): Promise<void> {
    console.log("🛑 Stopping offline Moonshine transcription...");
    this._isRecording = false;
    
    // Tell worker to reset VAD state
    if (this.worker) {
      this.worker.postMessage({ type: "reset" });
    }
    
    await this.cleanup();
    this.callbacks.onStatusChange?.("idle");
  }

  destroy(): void {
    this.stopTranscription();
    if (this.worker) {
      this.worker.postMessage({ type: "unload" });
      this.worker.terminate();
      this.worker = null;
    }
    this.isModelReady = false;
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
    case "assemblyai":
      return new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey || "",
        callbacks
      );
    case "groq":
      return new GroqTranscriptionService(
        settings.groqApiKey || "",
        settings.groqModel || "whisper-large-v3",
        callbacks
      );
    case "offline-whisper":
      return new OfflineWhisperTranscriptionService(
        settings.offlineWhisperModel || "onnx-community/whisper-base",
        settings.offlineLanguage || "en",
        callbacks
      );
    case "offline-moonshine":
      return new OfflineMoonshineTranscriptionService(
        settings.offlineMoonshineModel || "onnx-community/moonshine-base-ONNX",
        callbacks
      );
    // Future engines can be added here
    // case 'elevenlabs':
    //   return new ElevenLabsTranscriptionService(settings, callbacks);
    default:
      return new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey || "",
        callbacks
      );
  }
}
