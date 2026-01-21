/**
 * Transcription Service
 *
 * Provides live transcription capabilities using AssemblyAI Universal Streaming (v3) API.
 * Uses raw WebSocket connection and Web Audio API for audio capture.
 *
 * This service handles:
 * - Audio capture from microphone using Web Audio API (ScriptProcessor)
 * - Real-time transcription via AssemblyAI WebSocket (v3)
 * - Interim and final transcript handling via Turn events
 *
 * Migration to v3 (January 2026):
 * - Endpoint changed from /v2/realtime/ws to streaming.assemblyai.com/v3/ws
 * - Message types changed: PartialTranscript/FinalTranscript -> Turn with end_of_turn flag
 * - Field names changed: text -> transcript
 */

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
// ASSEMBLYAI TRANSCRIPTION SERVICE (Universal Streaming v3)
// =============================================================================

/**
 * AssemblyAI Universal Streaming (v3) Transcription Service
 *
 * Uses raw WebSocket connection to AssemblyAI's v3 streaming endpoint.
 * Audio is captured from the microphone at 16kHz sample rate and sent to AssemblyAI.
 *
 * v3 API changes from v2:
 * - Endpoint: wss://streaming.assemblyai.com/v3/ws (was /v2/realtime/ws)
 * - Messages: Turn events with end_of_turn flag (was PartialTranscript/FinalTranscript)
 * - Fields: transcript (was text)
 */
export class AssemblyAITranscriptionService implements ITranscriptionService {
  readonly engine: TranscriptionEngine = "assemblyai";

  private apiKey: string = "";
  private websocket: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private selectedMicId: string = "";
  private audioCaptureMode: "webrtc" | "native" = "webrtc";
  private selectedNativeDeviceId: string | null = null;
  private nativeUnlisten: null | (() => void) = null;
  private callbacks: TranscriptionCallbacks = {};
  private _isRecording: boolean = false;
  private segmentCounter: number = 0;
  private currentTurnOrder: number = 0;
  private finalizedTurnOrder: number | null = null;
  private readonly formatTurns: boolean = true;

  // v3 WebSocket endpoint
  private static readonly V3_STREAMING_ENDPOINT = "wss://streaming.assemblyai.com/v3/ws";

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
   * Get a temporary token from AssemblyAI (v3)
   */
  private async getTemporaryToken(): Promise<string> {
    try {
      console.log("🔑 Requesting temporary token from AssemblyAI (v3)...");
      // v3 tokens have max 600 seconds (10 minutes)
      const token = await getAssemblyAITemporaryToken(this.apiKey, 600);
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

    // Clean up existing WebSocket
    if (this.websocket) {
      console.log("⚠️ Existing WebSocket found, cleaning up...");
      try {
        this.websocket.close();
      } catch (error) {
        console.error("Error closing existing WebSocket:", error);
      }
      this.websocket = null;
    }

    // Clean up Web Audio processing
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
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
   * Send audio data to v3 WebSocket
   */
  private sendAudio(audioData: ArrayBuffer | Int16Array | Uint8Array): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const buffer =
      audioData instanceof ArrayBuffer
        ? audioData
        : audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
          );

    // v3 expects raw PCM bytes as binary WebSocket messages
    this.websocket.send(buffer);
  }

  /**
   * Handle v3 WebSocket messages
   */
  private handleV3Message(data: {
    type: string;
    id?: string;
    expires_at?: number;
    transcript?: string;
    end_of_turn?: boolean;
    turn_is_formatted?: boolean;
    turn_order?: number;
    utterance?: string;
    audio_duration_seconds?: number;
    session_duration_seconds?: number;
    error?: string;
  }): void {
    switch (data.type) {
      case "Begin":
        console.log(`✅ AssemblyAI v3 session started: ${data.id}`);
        break;

      case "Turn": {
        const transcript = data.transcript || "";
        const endOfTurn = data.end_of_turn === true;
        const formatted = data.turn_is_formatted === true;
        const turnOrder = data.turn_order || 0;

        // Track current turn order
        if (turnOrder !== this.currentTurnOrder) {
          this.currentTurnOrder = turnOrder;
          this.finalizedTurnOrder = null;
        }

        const shouldFinalize =
          transcript &&
          (formatted || (!this.formatTurns && endOfTurn)) &&
          this.finalizedTurnOrder !== turnOrder;

        if (shouldFinalize) {
          this.finalizedTurnOrder = turnOrder;
          console.log("📝 Final transcript:", transcript);

          const segment: TranscriptionSegment = {
            id: `segment-${++this.segmentCounter}`,
            text: transcript,
            timestamp: Date.now(),
            isFinal: true,
          };

          this.callbacks.onFinalTranscript?.(transcript, segment);
        } else if (transcript) {
          // Interim transcript
          this.callbacks.onInterimTranscript?.(transcript);
        }
        break;
      }

      case "Termination":
        console.log(
          `🔌 Session terminated. Audio: ${data.audio_duration_seconds}s, Session: ${data.session_duration_seconds}s`
        );
        break;

      case "Error":
        console.error("❌ AssemblyAI error:", data.error);
        this.callbacks.onError?.(new Error(data.error || "AssemblyAI error"));
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  /**
   * Start live transcription using v3 Universal Streaming
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

      console.log("🎬 Connecting to AssemblyAI Universal Streaming (v3)...");

      // Get temporary token
      const token = await this.getTemporaryToken();

      // Build v3 WebSocket URL with query parameters
      const wsUrl = new URL(AssemblyAITranscriptionService.V3_STREAMING_ENDPOINT);
      wsUrl.searchParams.set("sample_rate", "16000");
      wsUrl.searchParams.set("token", token);
      // format_turns=true gives us formatted text (punctuation, casing) on end_of_turn
      wsUrl.searchParams.set("format_turns", this.formatTurns ? "true" : "false");
      wsUrl.searchParams.set("encoding", "pcm_s16le");

      // Create WebSocket connection
      this.websocket = new WebSocket(wsUrl.toString());

      // Handle WebSocket events
      this.websocket.onopen = async () => {
        console.log("✅ WebSocket connected to v3 endpoint");

        // Start audio capture after connection is established
        try {
          await this.startAudioCapture();
          this._isRecording = true;
          this.callbacks.onStatusChange?.("recording");
          console.log("✅ AssemblyAI v3 transcription started successfully");
        } catch (error) {
          console.error("Failed to start audio capture:", error);
          this._isRecording = false;
          this.callbacks.onStatusChange?.("error");
          this.callbacks.onError?.(error as Error);
          await this.cleanup();
        }
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleV3Message(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.websocket.onerror = (event) => {
        console.error("❌ WebSocket error:", event);
        this.callbacks.onError?.(new Error("WebSocket connection error"));
      };

      this.websocket.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
        this._isRecording = false;
        this.stopNativeAudioCapture().catch(() => {});
        this.callbacks.onConnectionClose?.(event.code, event.reason);
        this.callbacks.onStatusChange?.("idle");
      };
    } catch (error) {
      console.error("Failed to start transcription:", error);
      this._isRecording = false;
      this.callbacks.onStatusChange?.("error");
      this.callbacks.onError?.(error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Start audio capture (called after WebSocket is connected)
   */
  private async startAudioCapture(): Promise<void> {
    if (this.audioCaptureMode === "native") {
      console.log("🎛️ Using native audio capture (cpal) via Tauri backend...");

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
          if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
          try {
            const bytes = base64ToUint8Array(evt.payload.data_b64);
            this.sendAudio(bytes);
          } catch {
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
          ? {
              deviceId: { exact: this.selectedMicId },
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            }
          : {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
      };

      console.log("🎤 Requesting microphone access...");
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("✅ Microphone access granted");

      // Use Web Audio API to get raw PCM frames
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        this.sendAudio(pcm16);
      };

      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      console.log("🎙️ Recording started (PCM16 streaming)");
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

    // Stop Web Audio processing
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
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
    if (this.websocket) {
      console.log("🔌 Closing WebSocket...");
      try {
        // Send terminate message before closing (optional but cleaner)
        if (this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({ type: "Terminate" }));
        }
        this.websocket.close();
        console.log("✅ WebSocket closed");
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      }
      this.websocket = null;
    }

    // Reset state
    this.currentTurnOrder = 0;
    this.finalizedTurnOrder = null;
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
