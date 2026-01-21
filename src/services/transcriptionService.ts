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
    // Future engines can be added here
    // case 'elevenlabs':
    //   return new ElevenLabsTranscriptionService(settings, callbacks);
    // case 'whisper':
    //   return new WhisperTranscriptionService(settings, callbacks);
    default:
      return new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey || "",
        callbacks
      );
  }
}
