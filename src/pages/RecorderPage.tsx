/**
 * Recorder Page
 * 
 * Main recording interface with side-by-side video and audio recording panels.
 * Uses native audio recording for WAV and web recording for MP3.
 * Video recording uses browser MediaRecorder with high-quality settings.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaPause, FaStop, FaPlay, FaCircle } from "react-icons/fa";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Mp3Encoder } from "lamejs";
import { useStageAssist } from "../contexts/StageAssistContext";
import {
  loadRecorderSettings,
  saveRecorderSettings,
  getVideoDevices,
  getAudioDevices,
  getVideoStream,
  getAudioOnlyStream,
  createVideoRecorder,
  createAudioRecorder,
  createAudioAnalyzer,
  formatRecordingTime,
  saveRecordingToFile,
  getNativeAudioDevices,
  startNativeAudioRecording as startNativeAudioRecordingService,
  stopNativeAudioRecording as stopNativeAudioRecordingService,
  getNativeAudioRecordingDuration,
  generateNativeAudioFilePath,
  NativeAudioDevice,
  VideoRecorderConfig,
} from "../services/recorderService";
import {
  RecorderSettings,
  MediaDeviceOption,
  RecordingStatus,
} from "../types/recorder";
import "../App.css";

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    padding: "20px",
    height: "calc(100vh - 51px)",
    backgroundColor: "var(--app-bg-color)",
    overflow: "auto",
  },
  dashboardCard: {
    backgroundColor: "var(--app-header-bg)",
    borderRadius: "16px",
    border: "1px solid var(--app-border-color)",
    overflow: "hidden",
  },
  panelsContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1px",
    backgroundColor: "var(--app-border-color)",
  },
  panel: {
    backgroundColor: "var(--app-header-bg)",
    padding: "24px",
  },
  panelTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  panelTitleText: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "1.1rem",
    fontWeight: 500,
    margin: 0,
  },
  formatBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  formatBadgeVideo: {
    background: "rgba(139, 92, 246, 0.2)",
    color: "#a78bfa",
    border: "1px solid rgba(139, 92, 246, 0.3)",
  },
  formatBadgeAudio: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    border: "1px solid rgba(59, 130, 246, 0.3)",
  },
  formatBadgeResolution: {
    background: "rgba(16, 185, 129, 0.2)",
    color: "#34d399",
    border: "1px solid rgba(16, 185, 129, 0.3)",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  statusIdle: {
    background: "rgba(100, 116, 139, 0.2)",
    color: "#64748b",
  },
  statusRecording: {
    background: "rgba(255, 59, 92, 0.2)",
    color: "#ff3b5c",
    animation: "pulse 1.5s infinite",
  },
  statusPaused: {
    background: "rgba(251, 191, 36, 0.2)",
    color: "#fbbf24",
  },
  statusStopped: {
    background: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
  },
  videoPreview: {
    aspectRatio: "16/9",
    backgroundColor: "#0a0a0f",
    borderRadius: "12px",
    border: "1px solid var(--app-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    overflow: "hidden",
    position: "relative" as const,
  },
  videoElement: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    borderRadius: "12px",
  },
  previewPlaceholder: {
    textAlign: "center" as const,
    color: "#64748b",
  },
  audioVisualizer: {
    height: "100px",
    backgroundColor: "#0a0a0f",
    borderRadius: "12px",
    border: "1px solid var(--app-border-color)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    padding: "0 20px",
    overflow: "hidden",
  },
  audioBar: {
    width: "4px",
    background: "linear-gradient(180deg, #3b82f6, #8b5cf6)",
    borderRadius: "2px",
    transition: "height 0.05s ease-out",
  },
  timeDisplay: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "1.5rem",
    fontWeight: 600,
    textAlign: "center" as const,
    marginBottom: "16px",
  },
  controlsContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  controlBtn: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  recordBtn: {
    width: "72px",
    height: "72px",
    background: "linear-gradient(135deg, #ff3b5c, #ff1744)",
    boxShadow: "0 4px 20px rgba(255, 59, 92, 0.3)",
    color: "white",
  },
  recordBtnDisabled: {
    background: "rgba(100, 116, 139, 0.3)",
    boxShadow: "none",
    color: "rgba(255, 255, 255, 0.5)",
    cursor: "not-allowed",
  },
  stopBtn: {
    width: "72px",
    height: "72px",
    background: "linear-gradient(135deg, #ff1744, #ff1744)",
    boxShadow: "0 4px 20px rgba(255, 59, 92, 0.3)",
    color: "white",
  },
  secondaryBtn: {
    background: "var(--app-bg-color)",
    border: "1px solid var(--app-border-color)",
    color: "var(--app-text-color-secondary)",
  },
  newRecordingBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "12px",
    marginTop: "8px",
    background: "var(--app-bg-color)",
    border: "1px solid var(--app-border-color)",
    borderRadius: "10px",
    color: "var(--app-text-color)",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.2s",
    fontWeight: 500,
  },
  formatLabelsRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
  },
  deviceSelectRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  deviceSelect: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid var(--app-border-color)",
    backgroundColor: "var(--app-bg-color)",
    color: "var(--app-text-color)",
    fontSize: "0.85rem",
  },
  audioPreviewContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  audioPlayer: {
    width: "100%",
  },
  toggleDisabled: {
    background: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    color: "#ef4444",
  },
};

// ============================================================================
// Main Component
// ============================================================================

const RecorderPage: React.FC = () => {
  // Settings
  const [settings, setSettings] = useState<RecorderSettings | null>(null);

  // Video recording state
  const [videoStatus, setVideoStatus] = useState<RecordingStatus>("idle");
  const [isVideoStarting, setIsVideoStarting] = useState(false);
  const [videoElapsedTime, setVideoElapsedTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoPreviewStream, setVideoPreviewStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [videoAudioDevices, setVideoAudioDevices] = useState<MediaDeviceOption[]>([]);

  // Audio recording state
  const [audioStatus, setAudioStatus] = useState<RecordingStatus>("idle");
  const [isAudioStarting, setIsAudioStarting] = useState(false);
  const [audioElapsedTime, setAudioElapsedTime] = useState(0);
  const [audioRecordedPath, setAudioRecordedPath] = useState<string | null>(null);
  const [audioRecordedUrl, setAudioRecordedUrl] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(60).fill(0.1));
  const [nativeAudioDevices, setNativeAudioDevices] = useState<NativeAudioDevice[]>([]);

  // Toggle states for video/mic enable
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const [stopConfirmTarget, setStopConfirmTarget] = useState<"video" | "audio" | "both" | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecordingAudioCleanupRef = useRef<(() => void) | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyzerRef = useRef<ReturnType<typeof createAudioAnalyzer> | null>(null);
  const audioMeterStreamRef = useRef<MediaStream | null>(null);
  const audioMeterFrameRef = useRef<number | null>(null);
  const audioMeterUsesRecordingStreamRef = useRef(false);
  const audioRecordingModeRef = useRef<"native" | "web">("native");
  const audioPreviewObjectUrlRef = useRef<string | null>(null);
  const videoPreviewRequestSeqRef = useRef(0);
  const videoStopResolverRef = useRef<(() => void) | null>(null);
  const audioStopResolverRef = useRef<(() => void) | null>(null);

  const videoTimerRef = useRef<number | null>(null);
  const audioTimerRef = useRef<number | null>(null);

  // Get current session from Stage Assist
  const { schedule, currentSessionIndex } = useStageAssist();
  const currentSession = currentSessionIndex !== null ? schedule[currentSessionIndex] : null;

  const loadDevices = useCallback(async () => {
    try {
      const [video, audio, nativeAudio] = await Promise.all([
        getVideoDevices(),
        getAudioDevices(),
        getNativeAudioDevices(),
      ]);
      setVideoDevices(video);
      setVideoAudioDevices(audio);
      setNativeAudioDevices(nativeAudio);
    } catch (err) {
      console.error("Failed to load recording devices:", err);
    }
  }, []);

  const updateSettings = useCallback((partial: Partial<RecorderSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      saveRecorderSettings(next);
      return next;
    });
  }, []);

  // Load settings and devices on mount
  useEffect(() => {
    const loadedSettings = loadRecorderSettings();
    setSettings(loadedSettings);
    loadDevices();
  }, [loadDevices]);

  // Live refresh settings when changed in Recorder Settings page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RecorderSettings>).detail;
      if (detail) {
        setSettings(detail);
      } else {
        setSettings(loadRecorderSettings());
      }
    };
    window.addEventListener("recorder-settings-updated", handler as EventListener);
    return () => window.removeEventListener("recorder-settings-updated", handler as EventListener);
  }, []);

  const revokeAudioPreviewObjectUrl = useCallback(() => {
    if (audioPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(audioPreviewObjectUrlRef.current);
      audioPreviewObjectUrlRef.current = null;
    }
  }, []);

  // Attach preview stream to video element
  useEffect(() => {
    if (!videoRef.current || !videoPreviewStream) return;
    videoRef.current.srcObject = videoPreviewStream;
    const playPromise = videoRef.current.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn("Failed to play video preview:", err);
      });
    }
  }, [videoPreviewStream]);

  const closeStopConfirm = useCallback(() => {
    setIsStopConfirmOpen(false);
    setStopConfirmTarget(null);
  }, []);

  const resolveVideoStop = useCallback(() => {
    if (videoStopResolverRef.current) {
      const resolver = videoStopResolverRef.current;
      videoStopResolverRef.current = null;
      resolver();
    }
  }, []);

  const resolveAudioStop = useCallback(() => {
    if (audioStopResolverRef.current) {
      const resolver = audioStopResolverRef.current;
      audioStopResolverRef.current = null;
      resolver();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (videoRecordingAudioCleanupRef.current) {
        videoRecordingAudioCleanupRef.current();
        videoRecordingAudioCleanupRef.current = null;
      }
      if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
        audioRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (audioMeterFrameRef.current) cancelAnimationFrame(audioMeterFrameRef.current);
      if (audioAnalyzerRef.current) audioAnalyzerRef.current.cleanup();
      if (audioMeterStreamRef.current && !audioMeterUsesRecordingStreamRef.current) {
        audioMeterStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      revokeAudioPreviewObjectUrl();
    };
  }, [revokeAudioPreviewObjectUrl]);

  // ============================================================================
  // Video Recording Functions
  // ============================================================================

  const startVideoPreview = useCallback(async () => {
    if (!settings) return;
    setCameraError(null);
    const requestSeq = ++videoPreviewRequestSeqRef.current;
    try {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
      }
      const stream = await getVideoStream(
        settings.selectedVideoDeviceId,
        settings.videoResolution,
        settings.selectedVideoAudioDeviceId ?? settings.selectedAudioDeviceId,
        false
      );

      // If user disabled video while we were requesting permission, immediately stop.
      if (!isVideoEnabled || requestSeq !== videoPreviewRequestSeqRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      videoStreamRef.current = stream;
      setVideoPreviewStream(stream);
    } catch (err) {
      console.error("Failed to start video preview:", err);
      setCameraError(err instanceof Error ? err.message : "Failed to access camera");
    }
  }, [settings, isVideoEnabled]);

  // Stop video preview
  const stopVideoPreview = useCallback(() => {
    // Invalidate any in-flight preview requests
    videoPreviewRequestSeqRef.current += 1;

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    if (videoPreviewStream) {
      videoPreviewStream.getTracks().forEach((t) => t.stop());
    }
    setVideoPreviewStream(null);

    // Clear the element srcObject so WebKit fully releases the camera
    if (videoRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (videoRef.current as any).srcObject = null;
      videoRef.current.load();
    }
  }, [videoPreviewStream]);

  // Toggle video on/off
  const toggleVideoEnabled = useCallback(() => {
    if (videoStatus === "recording" || videoStatus === "paused") return; // Don't toggle while recording
    
    setIsVideoEnabled((prev) => {
      const newValue = !prev;
      if (newValue) {
        // Re-enable: start preview
        startVideoPreview();
      } else {
        // Disable: stop preview
        stopVideoPreview();
      }
      return newValue;
    });
  }, [videoStatus, startVideoPreview, stopVideoPreview]);

  // Toggle mic on/off (for monitoring, not actual muting of recording)
  const toggleMicEnabled = useCallback(() => {
    if (audioStatus === "recording") return; // Don't toggle while recording
    setIsMicEnabled((prev) => !prev);
  }, [audioStatus]);

  // Start camera preview when settings load or device changes
  useEffect(() => {
    if (settings && videoStatus === "idle" && isVideoEnabled) {
      startVideoPreview();
    }
  }, [settings, videoStatus, startVideoPreview, isVideoEnabled]);

  const startVideoRecording = useCallback(async () => {
    if (!settings) return;

    // Warn if video is disabled
    if (!isVideoEnabled) {
      const proceed = window.confirm("Video is currently disabled. Enable video and start recording?");
      if (!proceed) return;
      setIsVideoEnabled(true);
    }

    setIsVideoStarting(true);

    // Ensure we have a stream
    if (!videoStreamRef.current) {
      await startVideoPreview();
      if (!videoStreamRef.current) {
        setIsVideoStarting(false);
        return;
      }
    }

    const stream = videoStreamRef.current;
    let recordingStream = stream;

    if (videoRecordingAudioCleanupRef.current) {
      videoRecordingAudioCleanupRef.current();
      videoRecordingAudioCleanupRef.current = null;
    }

    try {
      const audioDeviceId =
        settings.selectedVideoAudioDeviceId ?? settings.selectedAudioDeviceId ?? null;
      const audioStream = await getAudioOnlyStream(audioDeviceId);
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      const splitter = audioContext.createChannelSplitter(2);
      const merger = audioContext.createChannelMerger(1);
      const gainLeft = audioContext.createGain();
      const gainRight = audioContext.createGain();
      gainLeft.gain.value = 0.5;
      gainRight.gain.value = 0.5;

      source.connect(splitter);
      splitter.connect(gainLeft, 0);
      gainLeft.connect(merger, 0, 0);

      try {
        splitter.connect(gainRight, 1);
        gainRight.connect(merger, 0, 0);
      } catch {
        // Some inputs are mono; ignore missing right channel.
      }

      const destination = audioContext.createMediaStreamDestination();
      const delaySeconds = Math.min(
        Math.max(0, (settings.videoAudioDelayMs || 0) / 1000),
        2
      );
      const delayNode = audioContext.createDelay(2);
      delayNode.delayTime.value = delaySeconds;
      merger.connect(delayNode);
      delayNode.connect(destination);

      const monoAudioTrack = destination.stream.getAudioTracks()[0];
      if (monoAudioTrack) {
        recordingStream = new MediaStream([...stream.getVideoTracks(), monoAudioTrack]);
      }

      videoRecordingAudioCleanupRef.current = () => {
        source.disconnect();
        splitter.disconnect();
        merger.disconnect();
        delayNode.disconnect();
        gainLeft.disconnect();
        gainRight.disconnect();
        audioStream.getTracks().forEach((track) => track.stop());
        audioContext.close();
      };
    } catch (err) {
      console.warn("Failed to capture mono audio for video recording:", err);
    }
    
    // Create recorder with high quality settings
    const videoRecorderConfig: VideoRecorderConfig = createVideoRecorder(
      recordingStream,
      settings.videoFormat,
      settings.videoAudioCodec
    );
    const { recorder, mimeType, fileExtension } = videoRecorderConfig;
    videoChunksRef.current = [];

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        videoChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const resolvedMimeType =
        mimeType ||
        recorder.mimeType ||
        (fileExtension === "mp4" ? "video/mp4" : "video/webm");
      const blob = new Blob(videoChunksRef.current, { type: resolvedMimeType });

      // Stop the camera stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
      }
      if (videoRecordingAudioCleanupRef.current) {
        videoRecordingAudioCleanupRef.current();
        videoRecordingAudioCleanupRef.current = null;
      }
      setVideoPreviewStream(null);
      setCameraError(null);

      // Save to file
      const result = await saveRecordingToFile(
        blob,
        "video",
        settings,
        currentSession?.session,
        fileExtension
      );

      if (!result.success) {
        console.error("Failed to save video:", result.error);
      }

      setVideoStatus("stopped");
      resolveVideoStop();
    };

    videoRecorderRef.current = recorder;
    recorder.start(1000);

    setVideoStatus("recording");
    setIsVideoStarting(false);
    setVideoElapsedTime(0);

    // Start timer
    const startTime = Date.now();
    videoTimerRef.current = window.setInterval(() => {
      setVideoElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
  }, [settings, startVideoPreview, currentSession, isVideoEnabled, resolveVideoStop]);

  const pauseVideoRecording = useCallback(() => {
    if (videoRecorderRef.current && videoStatus === "recording") {
      videoRecorderRef.current.pause();
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      setVideoStatus("paused");
    } else if (videoRecorderRef.current && videoStatus === "paused") {
      videoRecorderRef.current.resume();
      const resumeTime = Date.now() - videoElapsedTime * 1000;
      videoTimerRef.current = window.setInterval(() => {
        setVideoElapsedTime(Math.floor((Date.now() - resumeTime) / 1000));
      }, 100);
      setVideoStatus("recording");
    }
  }, [videoStatus, videoElapsedTime]);

  const stopVideoRecordingCore = useCallback(() => {
    if (videoRecorderRef.current && (videoStatus === "recording" || videoStatus === "paused")) {
      videoRecorderRef.current.stop();
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
        videoTimerRef.current = null;
      }
    } else if (videoStatus === "recording" || videoStatus === "paused") {
      resolveVideoStop();
    }
  }, [videoStatus, resolveVideoStop]);

  const stopVideoRecording = useCallback(
    (reason: "manual" | "automation" = "manual") => {
      if (videoStatus !== "recording" && videoStatus !== "paused") return;
      if (reason === "manual") {
        setStopConfirmTarget("video");
        setIsStopConfirmOpen(true);
        return;
      }
      closeStopConfirm();
      stopVideoRecordingCore();
    },
    [videoStatus, stopVideoRecordingCore, closeStopConfirm]
  );

  const startNewVideoRecording = useCallback(async () => {
    setVideoStatus("idle");
    setVideoElapsedTime(0);
    
    // Restart camera preview
    await startVideoPreview();
  }, [startVideoPreview]);

  // ============================================================================
  // Audio Recording Functions
  // ============================================================================

  const stopAudioMeter = useCallback(() => {
    if (audioMeterFrameRef.current) {
      cancelAnimationFrame(audioMeterFrameRef.current);
      audioMeterFrameRef.current = null;
    }
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.cleanup();
      audioAnalyzerRef.current = null;
    }
    if (audioMeterStreamRef.current && !audioMeterUsesRecordingStreamRef.current) {
      audioMeterStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    audioMeterStreamRef.current = null;
    audioMeterUsesRecordingStreamRef.current = false;
  }, []);

  const startAudioMeter = useCallback(
    async (stream?: MediaStream) => {
      if (!settings) return;
      stopAudioMeter();

      try {
        let meterStream: MediaStream;
        if (stream) {
          meterStream = stream;
        } else {
          // For native audio recording, the selectedAudioDeviceId is a native device ID
          // which doesn't work with browser getUserMedia. Try with the ID first,
          // then fall back to default device if it fails.
          try {
            meterStream = await getAudioOnlyStream(settings.selectedAudioDeviceId);
          } catch {
            // Fall back to default audio device for meter visualization
            console.log("Falling back to default audio device for meter");
            meterStream = await getAudioOnlyStream(null);
          }
        }
        audioMeterStreamRef.current = meterStream;
        audioMeterUsesRecordingStreamRef.current = Boolean(stream);

        const analyzer = createAudioAnalyzer(meterStream);
        audioAnalyzerRef.current = analyzer;

        const render = () => {
          const levels = analyzer.getAudioLevels();
          const targetBars = 60;
          const nextLevels = Array.from({ length: targetBars }, (_, i) => {
            const start = Math.floor((i / targetBars) * levels.length);
            const end = Math.max(
              start + 1,
              Math.floor(((i + 1) / targetBars) * levels.length)
            );
            const slice = levels.slice(start, end);
            const avg = slice.reduce((sum, value) => sum + value, 0) / slice.length;
            return avg;
          });
          setAudioLevels(nextLevels);
          audioMeterFrameRef.current = requestAnimationFrame(render);
        };

        render();
      } catch (err) {
        console.error("Failed to start audio meter:", err);
      }
    },
    [settings, stopAudioMeter]
  );

  const encodeMp3FromBlob = useCallback(
    async (blob: Blob) => {
      const bitrate = settings?.audioBitrate
        ? parseInt(settings.audioBitrate.replace("k", ""), 10)
        : 192;

      const audioContext = new AudioContext();
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        // Force mono output: prevents "left-only" playback on some devices/players.
        const channels = audioBuffer.numberOfChannels;
        const encoder = new Mp3Encoder(1, audioBuffer.sampleRate, bitrate);
        const blockSize = 1152;
        const mp3Data: Int8Array[] = [];

        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : null;
        const monoChannel =
          rightChannel
            ? (() => {
                const out = new Float32Array(leftChannel.length);
                for (let i = 0; i < out.length; i += 1) {
                  out[i] = (leftChannel[i] + rightChannel[i]) / 2;
                }
                return out;
              })()
            : leftChannel;

        const toInt16 = (input: Float32Array) => {
          const output = new Int16Array(input.length);
          for (let i = 0; i < input.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, input[i]));
            output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          }
          return output;
        };

      for (let i = 0; i < monoChannel.length; i += blockSize) {
        const monoChunk = toInt16(monoChannel.subarray(i, i + blockSize));
        const mp3buf = encoder.encodeBuffer(monoChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        }

        const finalBuffer = encoder.flush();
        if (finalBuffer.length > 0) {
          mp3Data.push(new Int8Array(finalBuffer));
        }

        return new Blob(mp3Data, { type: "audio/mpeg" });
      } finally {
        await audioContext.close();
      }
    },
    [settings?.audioBitrate]
  );

  const startNativeAudioRecording = useCallback(async () => {
    if (!settings) return;

    try {
      setIsAudioStarting(true);
      audioRecordingModeRef.current = "native";
      setAudioRecordedPath(null);

      const filePath = generateNativeAudioFilePath(settings, currentSession?.session);
      await startNativeAudioRecordingService(
        settings.selectedAudioDeviceId,
        filePath,
        48000,
        800
      );

      setAudioStatus("recording");
      setAudioElapsedTime(0);

      // Pre-roll: give the input device a moment to "warm up" before we start counting time.
      const warmupMs = 800;
      window.setTimeout(() => {
        setIsAudioStarting(false);
        const startTime = Date.now();
        audioTimerRef.current = window.setInterval(async () => {
          try {
            const duration = await getNativeAudioRecordingDuration();
            setAudioElapsedTime(Math.floor(duration));
          } catch {
            setAudioElapsedTime(Math.floor((Date.now() - startTime) / 1000));
          }
        }, 100);
      }, warmupMs);

      await startAudioMeter();
    } catch (err) {
      console.error("Failed to start audio recording:", err);
      stopAudioMeter();
      setIsAudioStarting(false);
    }
  }, [settings, currentSession, startAudioMeter, stopAudioMeter]);

  const startWebAudioRecording = useCallback(async () => {
    if (!settings) return;

    try {
      setIsAudioStarting(true);
      audioRecordingModeRef.current = "web";
      setAudioRecordedPath(null);

      // For web audio recording, the selectedAudioDeviceId might be a native device ID
      // which doesn't work with browser getUserMedia. Try with the ID first,
      // then fall back to default device if it fails.
      let rawStream: MediaStream;
      try {
        rawStream = await getAudioOnlyStream(settings.selectedAudioDeviceId);
      } catch {
        console.log("Falling back to default audio device for web recording");
        rawStream = await getAudioOnlyStream(null);
      }

      // Force mono output using Web Audio API (browser channelCount constraint is unreliable)
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(rawStream);
      const splitter = audioContext.createChannelSplitter(2);
      const merger = audioContext.createChannelMerger(1);
      const gainLeft = audioContext.createGain();
      const gainRight = audioContext.createGain();
      gainLeft.gain.value = 0.5;
      gainRight.gain.value = 0.5;

      source.connect(splitter);
      splitter.connect(gainLeft, 0);
      gainLeft.connect(merger, 0, 0);

      try {
        splitter.connect(gainRight, 1);
        gainRight.connect(merger, 0, 0);
      } catch {
        // Some inputs are mono; ignore missing right channel.
      }

      const destination = audioContext.createMediaStreamDestination();
      merger.connect(destination);

      const monoStream = destination.stream;
      audioStreamRef.current = rawStream; // Keep raw stream for cleanup

      // Store cleanup function for audio context
      const cleanupAudioContext = () => {
        source.disconnect();
        splitter.disconnect();
        merger.disconnect();
        gainLeft.disconnect();
        gainRight.disconnect();
        audioContext.close();
      };

      const recorder = createAudioRecorder(monoStream, "mp3", settings.audioBitrate);
      audioChunksRef.current = [];

      recorder.onerror = (e) => {
        console.error("MediaRecorder audio error:", e);
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Clean up audio context used for mono conversion
        cleanupAudioContext();

        const mimeType = recorder.mimeType || "audio/webm";
        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType });
        let outputBlob = rawBlob;

        if (settings.audioFormat === "mp3") {
          try {
            outputBlob = await encodeMp3FromBlob(rawBlob);
          } catch (err) {
            console.error("MP3 encoding failed, saving raw audio instead:", err);
          }
        }

        // Always set preview from the in-memory blob (never a raw filesystem path)
        revokeAudioPreviewObjectUrl();
        audioPreviewObjectUrlRef.current = URL.createObjectURL(outputBlob);
        setAudioRecordedUrl(audioPreviewObjectUrlRef.current);

        const result = await saveRecordingToFile(
          outputBlob,
          "audio",
          settings,
          currentSession?.session
        );
        if (result.success) {
          setAudioRecordedPath(result.filePath || null);
        } else {
          console.error("Failed to save audio:", result.error);
        }

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        audioRecorderRef.current = null;
        setAudioStatus("stopped");
        resolveAudioStop();
      };

      audioRecorderRef.current = recorder;
      // Pre-roll: let the mic settle before starting MediaRecorder.
      await new Promise((r) => setTimeout(r, 800));
      recorder.start(1000);

      setAudioStatus("recording");
      setIsAudioStarting(false);
      setAudioElapsedTime(0);

      const startTime = Date.now();
      audioTimerRef.current = window.setInterval(() => {
        setAudioElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100);

      await startAudioMeter(monoStream);
    } catch (err) {
      console.error("Failed to start web audio recording:", err);
      stopAudioMeter();
      setIsAudioStarting(false);
    }
  }, [
    settings,
    currentSession,
    startAudioMeter,
    stopAudioMeter,
    encodeMp3FromBlob,
    revokeAudioPreviewObjectUrl,
    resolveAudioStop,
  ]);

  const startAudioRecording = useCallback(async () => {
    if (!settings) return;

    // Warn if mic is disabled
    if (!isMicEnabled) {
      const proceed = window.confirm("Microphone is currently disabled. Enable microphone and start recording?");
      if (!proceed) return;
      setIsMicEnabled(true);
    }

    if (settings.audioFormat === "mp3") {
      await startWebAudioRecording();
    } else {
      await startNativeAudioRecording();
    }
  }, [settings, startWebAudioRecording, startNativeAudioRecording, isMicEnabled]);

  const stopAudioRecordingCore = useCallback(async () => {
    if (audioStatus !== "recording") return;

    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }

    stopAudioMeter();
    setAudioLevels(new Array(60).fill(0.1));

    if (audioRecordingModeRef.current === "native") {
      try {
        const result = await stopNativeAudioRecordingService();
        setAudioRecordedPath(result.file_path);
        // Prefer blob URL preview for WAV (more reliable than passing file paths / asset URLs)
        revokeAudioPreviewObjectUrl();
        try {
          const fs = await import("@tauri-apps/plugin-fs");
          const bytes = await (fs as any).readFile(result.file_path as any);
          const wavBlob = new Blob([bytes], { type: "audio/wav" });
          audioPreviewObjectUrlRef.current = URL.createObjectURL(wavBlob);
          setAudioRecordedUrl(audioPreviewObjectUrlRef.current);
        } catch (e) {
          // Fallback: try asset protocol
          setAudioRecordedUrl(convertFileSrc(result.file_path, "asset"));
        }
        setAudioStatus("stopped");
      } catch (err) {
        console.error("Failed to stop audio recording:", err);
      } finally {
        resolveAudioStop();
      }
      return;
    }

    if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
      audioRecorderRef.current.stop();
    } else {
      resolveAudioStop();
    }
  }, [audioStatus, stopAudioMeter, resolveAudioStop, revokeAudioPreviewObjectUrl]);

  const stopAudioRecording = useCallback(
    async (reason: "manual" | "automation" = "manual") => {
      if (audioStatus !== "recording") return;
      if (reason === "manual") {
        setStopConfirmTarget("audio");
        setIsStopConfirmOpen(true);
        return;
      }
      closeStopConfirm();
      await stopAudioRecordingCore();
    },
    [audioStatus, stopAudioRecordingCore, closeStopConfirm]
  );

  const startNewAudioRecording = useCallback(() => {
    revokeAudioPreviewObjectUrl();
    setAudioRecordedPath(null);
    setAudioRecordedUrl(null);
    setAudioStatus("idle");
    setAudioElapsedTime(0);
    setAudioLevels(new Array(60).fill(0.1));
  }, [revokeAudioPreviewObjectUrl]);

  // ============================================================================
  // Automation Event Handlers (for Follow Master Timer feature)
  // ============================================================================

  // Refs for automation handlers (to avoid stale closures)
  const startVideoRecordingRef = useRef(startVideoRecording);
  const stopVideoRecordingRef = useRef<(reason?: "manual" | "automation") => void>(stopVideoRecording);
  const startAudioRecordingRef = useRef(startAudioRecording);
  const stopAudioRecordingRef = useRef<(reason?: "manual" | "automation") => void>(stopAudioRecording);
  const videoStatusRef = useRef(videoStatus);
  const audioStatusRef = useRef(audioStatus);

  // Keep refs updated
  useEffect(() => {
    startVideoRecordingRef.current = startVideoRecording;
    stopVideoRecordingRef.current = stopVideoRecording;
    startAudioRecordingRef.current = startAudioRecording;
    stopAudioRecordingRef.current = stopAudioRecording;
    videoStatusRef.current = videoStatus;
    audioStatusRef.current = audioStatus;
  }, [startVideoRecording, stopVideoRecording, startAudioRecording, stopAudioRecording, videoStatus, audioStatus]);

  // Listen for recording automation events
  useEffect(() => {
    const handleStartVideo = () => {
      console.log("[Automation] Received start video recording event");
      const run = async () => {
        if (videoStatusRef.current === "recording" || videoStatusRef.current === "paused") {
          await new Promise<void>((resolve) => {
            if (videoStopResolverRef.current) {
              const prev = videoStopResolverRef.current;
              videoStopResolverRef.current = () => {
                prev();
                resolve();
              };
            } else {
              videoStopResolverRef.current = resolve;
              stopVideoRecordingRef.current("automation");
            }
          });
        }
        await startVideoRecordingRef.current();
      };
      void run();
    };

    const handleStopVideo = () => {
      console.log("[Automation] Received stop video recording event");
      if (videoStatusRef.current === "recording" || videoStatusRef.current === "paused") {
        stopVideoRecordingRef.current("automation");
      } else {
        console.log("[Automation] Video not recording, skipping stop");
      }
    };

    const handleStartAudio = () => {
      console.log("[Automation] Received start audio recording event");
      const run = async () => {
        if (audioStatusRef.current === "recording") {
          await new Promise<void>((resolve) => {
            if (audioStopResolverRef.current) {
              const prev = audioStopResolverRef.current;
              audioStopResolverRef.current = () => {
                prev();
                resolve();
              };
            } else {
              audioStopResolverRef.current = resolve;
              stopAudioRecordingRef.current("automation");
            }
          });
        }
        await startAudioRecordingRef.current();
      };
      void run();
    };

    const handleStopAudio = () => {
      console.log("[Automation] Received stop audio recording event");
      if (audioStatusRef.current === "recording") {
        stopAudioRecordingRef.current("automation");
      } else {
        console.log("[Automation] Audio not recording, skipping stop");
      }
    };

    const handleStartBoth = () => {
      console.log("[Automation] Received start both recording event");
      const run = async () => {
        const stops: Promise<void>[] = [];
        if (videoStatusRef.current === "recording" || videoStatusRef.current === "paused") {
          stops.push(
            new Promise<void>((resolve) => {
              if (videoStopResolverRef.current) {
                const prev = videoStopResolverRef.current;
                videoStopResolverRef.current = () => {
                  prev();
                  resolve();
                };
              } else {
                videoStopResolverRef.current = resolve;
                stopVideoRecordingRef.current("automation");
              }
            })
          );
        }
        if (audioStatusRef.current === "recording") {
          stops.push(
            new Promise<void>((resolve) => {
              if (audioStopResolverRef.current) {
                const prev = audioStopResolverRef.current;
                audioStopResolverRef.current = () => {
                  prev();
                  resolve();
                };
              } else {
                audioStopResolverRef.current = resolve;
                stopAudioRecordingRef.current("automation");
              }
            })
          );
        }
        if (stops.length > 0) {
          await Promise.all(stops);
        }
        await Promise.all([startVideoRecordingRef.current(), startAudioRecordingRef.current()]);
      };
      void run();
    };

    const handleStopBoth = () => {
      console.log("[Automation] Received stop both recording event");
      if (videoStatusRef.current === "recording" || videoStatusRef.current === "paused") {
        stopVideoRecordingRef.current("automation");
      }
      if (audioStatusRef.current === "recording") {
        stopAudioRecordingRef.current("automation");
      }
    };

    window.addEventListener("automation-start-video-recording", handleStartVideo);
    window.addEventListener("automation-stop-video-recording", handleStopVideo);
    window.addEventListener("automation-start-audio-recording", handleStartAudio);
    window.addEventListener("automation-stop-audio-recording", handleStopAudio);
    window.addEventListener("automation-start-both-recording", handleStartBoth);
    window.addEventListener("automation-stop-both-recording", handleStopBoth);

    return () => {
      window.removeEventListener("automation-start-video-recording", handleStartVideo);
      window.removeEventListener("automation-stop-video-recording", handleStopVideo);
      window.removeEventListener("automation-start-audio-recording", handleStartAudio);
      window.removeEventListener("automation-stop-audio-recording", handleStopAudio);
      window.removeEventListener("automation-start-both-recording", handleStartBoth);
      window.removeEventListener("automation-stop-both-recording", handleStopBoth);
    };
  }, []);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getStatusBadgeStyle = (status: RecordingStatus): React.CSSProperties => {
    switch (status) {
      case "recording":
        return { ...styles.statusBadge, ...styles.statusRecording };
      case "paused":
        return { ...styles.statusBadge, ...styles.statusPaused };
      case "stopped":
        return { ...styles.statusBadge, ...styles.statusStopped };
      default:
        return { ...styles.statusBadge, ...styles.statusIdle };
    }
  };

  const getStatusText = (status: RecordingStatus): string => {
    switch (status) {
      case "recording":
        return "● Recording";
      case "paused":
        return "⏸ Paused";
      case "stopped":
        return "✓ Saved";
      default:
        return "Ready";
    }
  };

  const getVideoStatusText = (): string => {
    if (isVideoStarting) return "Starting…";
    return getStatusText(videoStatus);
  };

  const getAudioStatusText = (): string => {
    if (isAudioStarting) return "Starting…";
    return getStatusText(audioStatus);
  };

  const handleConfirmStop = async () => {
    const target = stopConfirmTarget;
    closeStopConfirm();
    if (target === "video") {
      stopVideoRecordingCore();
      return;
    }
    if (target === "audio") {
      await stopAudioRecordingCore();
      return;
    }
    if (target === "both") {
      stopVideoRecordingCore();
      await stopAudioRecordingCore();
    }
  };

  const stopConfirmTitle =
    stopConfirmTarget === "both"
      ? "Stop video and audio recording?"
      : stopConfirmTarget === "video"
      ? "Stop video recording?"
      : "Stop audio recording?";

  if (!settings) {
    return (
      <div style={styles.pageContainer}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.dashboardCard}>
        {/* Panels */}
        <div style={styles.panelsContainer}>
          {/* Video Panel */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>
              <h4 style={styles.panelTitleText}>
                <FaVideo size={18} />
                Video Recording
              </h4>
              <span style={getStatusBadgeStyle(videoStatus)}>
                {getVideoStatusText()}
              </span>
            </div>

            {/* Format Labels */}
            <div style={styles.formatLabelsRow}>
              <span style={{ ...styles.formatBadge, ...styles.formatBadgeVideo }}>
                {settings.videoFormat.toUpperCase()}
              </span>
              <span style={{ ...styles.formatBadge, ...styles.formatBadgeAudio }}>
                {settings.videoAudioCodec.toUpperCase()}
              </span>
              <span style={{ ...styles.formatBadge, ...styles.formatBadgeResolution }}>
                {settings.videoResolution}
              </span>
            </div>

            {/* Camera Selection */}
            <div style={styles.deviceSelectRow}>
              <FaVideo size={14} />
              <select
                style={styles.deviceSelect}
                value={settings.selectedVideoDeviceId || ""}
                onChange={(e) => updateSettings({ selectedVideoDeviceId: e.target.value || null })}
                disabled={videoStatus === "recording" || videoStatus === "paused"}
              >
                <option value="">Default Camera</option>
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.deviceSelectRow}>
              <FaMicrophone size={14} />
              <select
                style={styles.deviceSelect}
                value={settings.selectedVideoAudioDeviceId || ""}
                onChange={(e) =>
                  updateSettings({ selectedVideoAudioDeviceId: e.target.value || null })
                }
                disabled={videoStatus === "recording" || videoStatus === "paused"}
              >
                <option value="">Default Microphone (Video Audio)</option>
                {videoAudioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Video Preview / Saved Message */}
            <div style={styles.videoPreview}>
              {videoStatus === "stopped" ? (
                <div style={styles.previewPlaceholder}>
                  <FaVideo size={48} style={{ opacity: 0.8, marginBottom: "12px", color: "#22c55e" }} />
                  <p style={{ color: "#22c55e", fontWeight: 500 }}>Recording saved!</p>
                  <p style={{ fontSize: "0.85em", opacity: 0.8 }}>
                    Your video file has been saved to disk.
                  </p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      ...styles.videoElement,
                      display: videoPreviewStream ? "block" : "none",
                    }}
                  />
                  {!videoPreviewStream && (
                    <div style={styles.previewPlaceholder}>
                      <FaVideo size={48} style={{ opacity: 0.5, marginBottom: "12px" }} />
                      <p>{cameraError || "Camera preview will appear here"}</p>
                      {cameraError && (
                        <button
                          onClick={startVideoPreview}
                          style={{
                            marginTop: "12px",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "1px solid var(--app-border-color)",
                            background: "var(--app-bg-color)",
                            color: "var(--app-text-color)",
                            cursor: "pointer",
                          }}
                        >
                          Retry Camera
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Timer */}
            <div
              style={{
                ...styles.timeDisplay,
                color: videoStatus === "recording" ? "#ff3b5c" : "inherit",
              }}
            >
              {formatRecordingTime(videoElapsedTime)}
            </div>

            {/* Controls */}
            <div style={styles.controlsContainer}>
              <button
                style={{ ...styles.controlBtn, ...styles.secondaryBtn }}
                onClick={pauseVideoRecording}
                disabled={videoStatus === "idle" || videoStatus === "stopped"}
              >
                {videoStatus === "paused" ? <FaPlay size={20} /> : <FaPause size={20} />}
              </button>
              
              {videoStatus === "idle" ? (
                <button
                  style={{
                    ...styles.controlBtn,
                    ...styles.recordBtn,
                    ...(isVideoStarting ? styles.recordBtnDisabled : {}),
                  }}
                  onClick={startVideoRecording}
                  disabled={isVideoStarting}
                >
                  <FaCircle size={24} />
                </button>
              ) : videoStatus === "stopped" ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.recordBtn }}
                  onClick={startNewVideoRecording}
                  title="Start new recording"
                >
                  <FaCircle size={24} />
                </button>
              ) : (
                <button
                  style={{ ...styles.controlBtn, ...styles.stopBtn }}
                  onClick={() => stopVideoRecording("manual")}
                >
                  <FaStop size={20} />
                </button>
              )}

              <button
                style={{
                  ...styles.controlBtn,
                  ...styles.secondaryBtn,
                  ...(isVideoEnabled ? {} : styles.toggleDisabled),
                }}
                onClick={toggleVideoEnabled}
                disabled={videoStatus === "recording" || videoStatus === "paused"}
                title={isVideoEnabled ? "Disable camera" : "Enable camera"}
              >
                {isVideoEnabled ? <FaVideo size={20} /> : <FaVideoSlash size={20} />}
              </button>
            </div>

            {/* New Recording Button */}
            {videoStatus === "stopped" && (
              <button
                style={styles.newRecordingBtn}
                onClick={startNewVideoRecording}
              >
                New Recording
              </button>
            )}
          </div>

          {/* Audio Panel */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>
              <h4 style={styles.panelTitleText}>
                <FaMicrophone size={18} />
                Audio Recording
              </h4>
              <span style={getStatusBadgeStyle(audioStatus)}>
                {getAudioStatusText()}
              </span>
            </div>

            {/* Format Labels */}
            <div style={styles.formatLabelsRow}>
              <span style={{ ...styles.formatBadge, ...styles.formatBadgeAudio }}>
                {settings.audioFormat.toUpperCase()}
              </span>
              <span style={{ ...styles.formatBadge, ...styles.formatBadgeResolution }}>
                {settings.audioFormat === "mp3" ? settings.audioBitrate : "48kHz"}
              </span>
            </div>

            {/* Microphone Selection */}
            <div style={styles.deviceSelectRow}>
              <FaMicrophone size={14} />
              <select
                style={styles.deviceSelect}
                value={settings.selectedAudioDeviceId || ""}
                onChange={(e) => updateSettings({ selectedAudioDeviceId: e.target.value || null })}
                disabled={audioStatus === "recording"}
              >
                <option value="">Default Microphone</option>
                {nativeAudioDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} {device.is_default ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Visualizer or Preview */}
            {audioRecordedUrl && audioStatus === "stopped" ? (
              <div style={styles.audioVisualizer}>
                <audio
                  controls
                  src={audioRecordedUrl}
                  style={styles.audioPlayer}
                  title={audioRecordedPath || undefined}
                />
              </div>
            ) : (
              <div style={styles.audioVisualizer}>
                {audioLevels.map((level, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.audioBar,
                      height: `${Math.max(10, level * 100)}%`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Timer */}
            <div
              style={{
                ...styles.timeDisplay,
                color: audioStatus === "recording" ? "#ff3b5c" : "inherit",
              }}
            >
              {formatRecordingTime(audioElapsedTime)}
            </div>

            {/* Controls */}
            <div style={styles.controlsContainer}>
              {audioStatus === "idle" ? (
                <button
                  style={{
                    ...styles.controlBtn,
                    ...styles.recordBtn,
                    ...(isAudioStarting ? styles.recordBtnDisabled : {}),
                  }}
                  onClick={startAudioRecording}
                  disabled={isAudioStarting}
                >
                  <FaCircle size={24} />
                </button>
              ) : audioStatus === "stopped" ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.recordBtn }}
                  onClick={startNewAudioRecording}
                  title="Start new recording"
                >
                  <FaCircle size={24} />
                </button>
              ) : (
                <button
                  style={{ ...styles.controlBtn, ...styles.stopBtn }}
                  onClick={() => stopAudioRecording("manual")}
                >
                  <FaStop size={20} />
                </button>
              )}

              <button
                style={{
                  ...styles.controlBtn,
                  ...styles.secondaryBtn,
                  ...(isMicEnabled ? {} : styles.toggleDisabled),
                }}
                onClick={toggleMicEnabled}
                disabled={audioStatus === "recording"}
                title={isMicEnabled ? "Disable microphone" : "Enable microphone"}
              >
                {isMicEnabled ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
              </button>
            </div>

            {/* New Recording Button */}
            {audioStatus === "stopped" && (
              <button
                style={styles.newRecordingBtn}
                onClick={startNewAudioRecording}
              >
                New Recording
              </button>
            )}
          </div>
        </div>

        {/* Current Session Info */}
        {currentSession && (
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid var(--app-border-color)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              fontSize: "0.9rem",
            }}
          >
            <strong>Current Session:</strong> {currentSession.session}
            {settings.includeSessionName && (
              <span style={{ color: "var(--app-text-color-secondary)", marginLeft: "8px" }}>
                (will be included in filename)
              </span>
            )}
          </div>
        )}
      </div>

      {isStopConfirmOpen && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: "420px", backgroundColor: "var(--app-header-bg)" }}
          >
            <h3 style={{ marginTop: 0 }}>{stopConfirmTitle}</h3>
            <p style={{ color: "var(--app-text-color-secondary)" }}>
              This will finalize the current recording and save it to disk.
            </p>
            <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
              <button onClick={closeStopConfirm} className="secondary">
                Cancel
              </button>
              <button onClick={handleConfirmStop} className="primary">
                Stop Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecorderPage;
