/**
 * Recorder Service
 * 
 * Handles video and audio recording functionality using the MediaRecorder API.
 * Manages device enumeration, recording state, and file saving via Tauri.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  RecorderSettings,
  DEFAULT_RECORDER_SETTINGS,
  RECORDER_SETTINGS_KEY,
  EnabledFeatures,
  DEFAULT_ENABLED_FEATURES,
  ENABLED_FEATURES_KEY,
  MediaDeviceOption,
  VideoResolution,
  VIDEO_RESOLUTION_CONFIG,
  AudioBitrate,
  AUDIO_BITRATE_CONFIG,
  RecordingResult,
} from "../types/recorder";

// ============================================================================
// Settings Management
// ============================================================================

export function loadRecorderSettings(): RecorderSettings {
  try {
    const stored = localStorage.getItem(RECORDER_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_RECORDER_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load recorder settings:", err);
  }
  return { ...DEFAULT_RECORDER_SETTINGS };
}

export function saveRecorderSettings(settings: RecorderSettings): void {
  try {
    localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify(settings));
    // Notify any open pages (e.g. RecorderPage) to refresh settings immediately
    window.dispatchEvent(new CustomEvent("recorder-settings-updated", { detail: settings }));
  } catch (err) {
    console.error("Failed to save recorder settings:", err);
  }
}

// ============================================================================
// Feature Flags Management
// ============================================================================

export function loadEnabledFeatures(): EnabledFeatures {
  try {
    const stored = localStorage.getItem(ENABLED_FEATURES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_ENABLED_FEATURES, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load enabled features:", err);
  }
  return { ...DEFAULT_ENABLED_FEATURES };
}

export function saveEnabledFeatures(features: EnabledFeatures): void {
  try {
    localStorage.setItem(ENABLED_FEATURES_KEY, JSON.stringify(features));
    // Dispatch event so App.tsx can update navigation
    window.dispatchEvent(new CustomEvent("features-updated", { detail: features }));
  } catch (err) {
    console.error("Failed to save enabled features:", err);
  }
}

// ============================================================================
// Device Enumeration
// ============================================================================

export async function getVideoDevices(): Promise<MediaDeviceOption[]> {
  try {
    // Request permission first to get full device labels
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${index + 1}`,
        kind: "videoinput" as const,
        isDefault: index === 0,
      }));
  } catch (err) {
    console.error("Failed to enumerate video devices:", err);
    return [];
  }
}

// WebRTC audio devices (fallback)
export async function getAudioDevices(): Promise<MediaDeviceOption[]> {
  try {
    // Request permission first to get full device labels
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${index + 1}`,
        kind: "audioinput" as const,
        isDefault: index === 0,
      }));
  } catch (err) {
    console.error("Failed to enumerate audio devices:", err);
    return [];
  }
}

// Native audio device type from Tauri backend
export interface NativeAudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

// Get native audio devices (high quality, system-level access)
export async function getNativeAudioDevices(): Promise<NativeAudioDevice[]> {
  try {
    const devices = await invoke<NativeAudioDevice[]>("list_native_audio_input_devices");
    return devices || [];
  } catch (err) {
    console.error("Failed to get native audio devices:", err);
    return [];
  }
}

// ============================================================================
// Native Audio Recording (High Quality via Rust/cpal)
// ============================================================================

export interface NativeRecordingInfo {
  file_path: string;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
}

export async function startNativeAudioRecording(
  deviceId: string | null,
  filePath: string,
  sampleRate?: number,
  warmupMs?: number
): Promise<void> {
  await invoke("start_native_audio_recording", {
    deviceId,
    filePath,
    sampleRate: sampleRate || 48000,
    warmupMs: warmupMs ?? 800,
  });
}

export async function stopNativeAudioRecording(): Promise<NativeRecordingInfo> {
  return await invoke<NativeRecordingInfo>("stop_native_audio_recording");
}

export async function isNativeAudioRecording(): Promise<boolean> {
  return await invoke<boolean>("is_audio_recording");
}

export async function getNativeAudioRecordingDuration(): Promise<number> {
  return await invoke<number>("get_audio_recording_duration");
}

// Generate full file path for native audio recording
export function generateNativeAudioFilePath(
  settings: RecorderSettings,
  sessionName?: string
): string {
  const filename = generateFilename("audio", settings, sessionName);
  let basePath = settings.outputBasePath.trim();
  if (!basePath.endsWith("/")) {
    basePath += "/";
  }
  return `${basePath}audio/${filename}`;
}

// ============================================================================
// Filename Generation
// ============================================================================

export function generateFilename(
  type: "video" | "audio",
  settings: RecorderSettings,
  sessionName?: string
): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  let baseName: string;

  switch (settings.namingPattern) {
    case "session_timestamp":
      if (sessionName && settings.includeSessionName) {
        // Sanitize session name for filename
        const sanitized = sessionName
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "_")
          .toLowerCase();
        baseName = `${sanitized}_${timestamp}`;
      } else {
        baseName = `recording_${timestamp}`;
      }
      break;
    case "custom_timestamp":
      baseName = `${settings.customPrefix}_${timestamp}`;
      break;
    case "timestamp":
    default:
      baseName = `recording_${timestamp}`;
      break;
  }

  const extension = type === "video" ? settings.videoFormat : settings.audioFormat;
  return `${baseName}.${extension}`;
}

// ============================================================================
// File Saving
// ============================================================================

export async function saveRecordingToFile(
  blob: Blob,
  type: "video" | "audio",
  settings: RecorderSettings,
  sessionName?: string
): Promise<RecordingResult> {
  try {
    const filename = generateFilename(type, settings, sessionName);
    const subFolder = type === "video" ? "video" : "audio";
    
    // Normalize base path
    let basePath = settings.outputBasePath.trim();
    if (!basePath.endsWith("/")) {
      basePath += "/";
    }
    
    const fullPath = `${basePath}${subFolder}/${filename}`;
    const { homeDir } = await import("@tauri-apps/api/path");
    let normalizedPath = fullPath;
    if (normalizedPath.startsWith("~/") || normalizedPath === "~") {
      const home = await homeDir();
      if (normalizedPath === "~") {
        normalizedPath = home;
      } else {
        normalizedPath = home + normalizedPath.slice(1);
      }
    }

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(
      uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Write file using Tauri
    await invoke("write_binary_to_file", {
      filePath: normalizedPath,
      dataBase64: base64,
    });

    return {
      success: true,
      filePath: normalizedPath,
      fileName: filename,
      fileSize: blob.size,
    };
  } catch (err) {
    console.error("Failed to save recording:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// Media Stream Helpers
// ============================================================================

export async function getVideoStream(
  deviceId: string | null,
  resolution: VideoResolution
): Promise<MediaStream> {
  const config = VIDEO_RESOLUTION_CONFIG[resolution];
  
  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: config.width },
      height: { ideal: config.height },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }, // Include raw audio in video recording
  };

  return await navigator.mediaDevices.getUserMedia(constraints);
}

export async function getAudioOnlyStream(
  deviceId: string | null
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };

  return await navigator.mediaDevices.getUserMedia(constraints);
}

// ============================================================================
// MediaRecorder Factory
// ============================================================================

export function createVideoRecorder(
  stream: MediaStream,
  format: "mp4" | "webm"
): MediaRecorder {
  // Determine the best supported MIME type
  const mimeTypes = format === "mp4"
    ? ["video/mp4", "video/webm;codecs=h264", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

  let selectedMimeType = "";
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType;
      break;
    }
  }

  if (!selectedMimeType) {
    // Fallback to browser default
    return new MediaRecorder(stream);
  }

  return new MediaRecorder(stream, { mimeType: selectedMimeType });
}

export function createAudioRecorder(
  stream: MediaStream,
  format: "mp3" | "wav",
  bitrate: AudioBitrate
): MediaRecorder {
  // Note: Browser MediaRecorder typically outputs webm/opus or ogg/opus
  // We'll handle format conversion on save or accept the browser's format
  const audioBps = AUDIO_BITRATE_CONFIG[bitrate];
  
  const mimeTypes = format === "wav"
    ? ["audio/wav", "audio/webm;codecs=pcm", "audio/webm", "audio/ogg"]
    : ["audio/mpeg", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];

  let selectedMimeType = "";
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType;
      break;
    }
  }

  const options: MediaRecorderOptions = {
    audioBitsPerSecond: audioBps,
  };

  if (selectedMimeType) {
    options.mimeType = selectedMimeType;
  }

  return new MediaRecorder(stream, options);
}

// ============================================================================
// Audio Level Analysis
// ============================================================================

export function createAudioAnalyzer(stream: MediaStream): {
  analyser: AnalyserNode;
  getAudioLevels: () => number[];
  cleanup: () => void;
} {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.8;
  
  source.connect(analyser);
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const getAudioLevels = (): number[] => {
    analyser.getByteFrequencyData(dataArray);
    // Return normalized values (0-1)
    return Array.from(dataArray).map((v) => v / 255);
  };

  const cleanup = () => {
    source.disconnect();
    audioContext.close();
  };

  return { analyser, getAudioLevels, cleanup };
}

// ============================================================================
// Time Formatting
// ============================================================================

export function formatRecordingTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// Output Folder Operations
// ============================================================================

export async function openOutputFolder(basePath: string, type?: "video" | "audio"): Promise<void> {
  try {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    const { homeDir } = await import("@tauri-apps/api/path");
    let path = basePath.trim();
    
    // Expand ~ to home directory
    if (path.startsWith("~/")) {
      const home = await homeDir();
      path = home + path.slice(2);
    }
    
    if (!path.endsWith("/")) {
      path += "/";
    }
    if (type) {
      path += type + "/";
    }
    await invoke("ensure_output_folder", { path });
    await openPath(path);
  } catch (err) {
    console.error("Failed to open output folder:", err);
  }
}
