import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FaSun, FaMoon, FaQuestionCircle, FaMicrophone, FaPlus, FaListUl, FaGripLines, FaDownload } from "react-icons/fa";
import { LiveSlidesWebSocket } from "../services/liveSlideService";
import {
  calculateSlideBoundaries,
  SlideBoundary,
} from "../utils/liveSlideParser";
import { LiveSlide, WsTranscriptionStream } from "../types/liveSlides";
import TranscriptOptionsMenu from "../components/transcription/TranscriptOptionsMenu";
import { saveTranscriptFile } from "../utils/transcriptDownload";
import "../App.css";

// Bullet point character for visual display (stripped when importing)
const BULLET_CHAR = "•";
const BULLET_PREFIX = `\t${BULLET_CHAR} `; // Tab + bullet + space

// Theme-aware styles factory
const getNotepadStyles = (isDark: boolean) => {
  const bg = isDark ? "#0d0d0d" : "#ffffff";
  const bgSecondary = isDark ? "#1a1a1a" : "#f5f5f5";
  const border = isDark ? "#2a2a2a" : "#e0e0e0";
  const text = isDark ? "#e0e0e0" : "#1a1a1a";
  const textSecondary = isDark ? "#666" : "#888";
  const textMuted = isDark ? "#555" : "#999";
  const buttonBg = isDark ? "#2a2a2a" : "#e8e8e8";
  const buttonBorder = isDark ? "#3a3a3a" : "#d0d0d0";
  const keyPointBorder = isDark ? "#f59e0b" : "#d97706";
  const keyPointBg = isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.08)";
  const scriptureBorder = isDark ? "#22c55e" : "#16a34a";
  const scriptureBg = isDark ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.08)";

  return {
    container: {
      height: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column" as const,
      backgroundColor: bg,
      color: text,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      overflow: "hidden",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 20px",
      backgroundColor: bgSecondary,
      borderBottom: `1px solid ${border}`,
      flexShrink: 0,
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    sessionBadge: {
      backgroundColor: "#3B82F6",
      color: "white",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
    connectionStatus: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "0.8rem",
      color: textSecondary,
    },
    statusDot: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      animation: "pulse 2s infinite",
    },
    copyButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "8px 16px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.85rem",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.2s ease",
    },
    helpButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.9rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      minWidth: "40px",
    },
    transcriptionToggleButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.85rem",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.2s ease",
      whiteSpace: "nowrap" as const,
    },
    themeToggle: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.9rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      minWidth: "40px",
    },
    helpPopup: {
      position: "absolute" as const,
      top: "60px",
      right: "20px",
      backgroundColor: bgSecondary,
      border: `1px solid ${border}`,
      borderRadius: "8px",
      padding: "16px",
      maxWidth: "400px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      zIndex: 1000,
    },
    helpTitle: {
      fontSize: "1rem",
      fontWeight: 600,
      marginBottom: "12px",
      color: text,
    },
    helpText: {
      fontSize: "0.85rem",
      lineHeight: "1.6",
      color: textSecondary,
      marginBottom: "8px",
    },
    helpExample: {
      fontSize: "0.8rem",
      fontFamily: "monospace",
      backgroundColor: bg,
      padding: "8px",
      borderRadius: "4px",
      marginTop: "8px",
      color: text,
      whiteSpace: "pre-wrap" as const,
    },
    helpButtonAction: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "8px 16px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.85rem",
      marginTop: "12px",
      width: "100%",
      transition: "all 0.2s ease",
    },
    editorWrapper: {
      flex: 1,
      display: "flex",
      overflow: "hidden",
      position: "relative" as const,
    },
    lineNumbers: {
      width: "50px",
      padding: "16px 8px",
      backgroundColor: bg,
      borderRight: `1px solid ${border}`,
      textAlign: "right" as const,
      fontSize: "0.85rem",
      lineHeight: "1.6",
      color: textMuted,
      overflow: "hidden",
      userSelect: "none" as const,
      flexShrink: 0,
    },
    colorIndicators: {
      width: "6px",
      backgroundColor: bg,
      flexShrink: 0,
      position: "relative" as const,
      overflow: "hidden",
    },
    textareaWrapper: {
      flex: 1,
      position: "relative" as const,
      overflow: "hidden",
    },
    textarea: {
      width: "100%",
      height: "100%",
      padding: "16px",
      backgroundColor: "transparent",
      color: text,
      border: "none",
      outline: "none",
      resize: "none" as const,
      fontFamily: "inherit",
      fontSize: "1rem",
      lineHeight: "1.6",
      caretColor: "#3B82F6",
    },
    transcriptionPanel: {
      width: "30%",
      minWidth: "280px",
      maxWidth: "520px",
      borderLeft: `1px solid ${border}`,
      backgroundColor: bgSecondary,
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
    },
    transcriptionPanelHeader: {
      padding: "12px",
      borderBottom: `1px solid ${border}`,
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
    },
    transcriptionHeaderTopRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    transcriptionHeaderActions: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    transcriptionTitle: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "0.9rem",
      fontWeight: 600,
      color: text,
    },
    transcriptionMeter: {
      height: "8px",
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: "999px",
      overflow: "hidden",
    },
    transcriptionFilters: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap" as const,
      fontSize: "0.8rem",
      color: textSecondary,
    },
    transcriptionFilterLabel: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      cursor: "pointer",
      userSelect: "none" as const,
    },
    transcriptionScroll: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "12px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
    },
    transcriptionInterim: {
      padding: "10px",
      borderRadius: "8px",
      border: `1px dashed ${border}`,
      backgroundColor: bg,
      color: textSecondary,
      fontSize: "0.85rem",
      lineHeight: "1.4",
    },
    transcriptionChunkCard: {
      padding: "10px",
      borderRadius: "10px",
      border: `1px solid ${border}`,
      backgroundColor: bg,
      display: "flex",
      flexDirection: "column" as const,
      gap: "8px",
    },
    transcriptionChunkTopRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    transcriptionChunkMeta: {
      fontSize: "0.75rem",
      color: textMuted,
    },
    transcriptionAddButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.8rem",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      whiteSpace: "nowrap" as const,
    },
    transcriptionChunkText: {
      fontSize: "0.9rem",
      color: text,
      lineHeight: "1.45",
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-word" as const,
    },
    transcriptionSubsection: {
      borderTop: `1px solid ${border}`,
      paddingTop: "8px",
      fontSize: "0.82rem",
      color: textSecondary,
      lineHeight: "1.35",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    keyPointCard: {
      border: `1px solid ${keyPointBorder}`,
      borderLeft: `4px solid ${keyPointBorder}`,
      borderRadius: "8px",
      padding: "8px 10px",
      backgroundColor: keyPointBg,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
    },
    keyPointText: {
      color: text,
      fontSize: "0.85rem",
      lineHeight: "1.4",
      wordBreak: "break-word" as const,
    },
    keyPointBadge: {
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      color: keyPointBorder,
      textTransform: "uppercase" as const,
    },
    keyPointAddButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "4px 8px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.75rem",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      whiteSpace: "nowrap" as const,
    },
    scriptureCard: {
      border: `1px solid ${scriptureBorder}`,
      borderLeft: `4px solid ${scriptureBorder}`,
      borderRadius: "8px",
      padding: "8px 10px",
      backgroundColor: scriptureBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    scriptureText: {
      color: scriptureBorder,
      fontSize: "0.85rem",
      fontWeight: 600,
      lineHeight: "1.4",
    },
    scriptureAddButton: {
      backgroundColor: buttonBg,
      color: text,
      border: `1px solid ${buttonBorder}`,
      padding: "4px 8px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.75rem",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      whiteSpace: "nowrap" as const,
    },
    footer: {
      padding: "8px 20px",
      backgroundColor: bgSecondary,
      borderTop: `1px solid ${border}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "0.8rem",
      color: textSecondary,
      flexShrink: 0,
    },
    slidesPreview: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
    },
    slideIndicator: {
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "0.75rem",
      fontWeight: 500,
    },
    border: border,
    input: {
      background: bg,
      color: text,
    },
  };
};

const LiveSlidesNotepad: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();

  // Theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("liveSlidesNotepadTheme");
    return saved === "light" ? false : true; // Default to dark
  });

  const [text, setText] = useState("");
  const [slides, setSlides] = useState<LiveSlide[]>([]);
  const [boundaries, setBoundaries] = useState<SlideBoundary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [showLiveTranscription, setShowLiveTranscription] = useState(false);
  const [liveInterimTranscript, setLiveInterimTranscript] = useState("");
  const [liveTranscriptChunks, setLiveTranscriptChunks] = useState<WsTranscriptionStream[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [filterTranscript, setFilterTranscript] = useState(true);
  const [filterReferences, setFilterReferences] = useState(true);
  const [filterKeyPoints, setFilterKeyPoints] = useState(true);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
  const [transcriptMenuOpen, setTranscriptMenuOpen] = useState(false);
  const [autoScrollTranscript, setAutoScrollTranscript] = useState(true);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [cursorLineIndex, setCursorLineIndex] = useState(0);
  const [showSlideDividers, setShowSlideDividers] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const colorIndicatorsRef = useRef<HTMLDivElement>(null);
  const slideDividersRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<LiveSlidesWebSocket | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptMenuRef = useRef<HTMLDivElement>(null);
  // Avoid stale closures in WS handlers (we intentionally do NOT re-bind on every keystroke).
  const textRef = useRef<string>("");
  const lastLocalEditAtRef = useRef<number>(0);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Get WebSocket connection info from URL params
  // The server now serves both HTTP and WebSocket on the same port, with WS at /ws path
  const wsHost = searchParams.get("wsHost") || "localhost";
  const wsPort = parseInt(searchParams.get("wsPort") || "9876", 10);
  const wsUrl = `ws://${wsHost}:${wsPort}/ws`;

  // Get theme-aware styles
  const notepadStyles = useMemo(
    () => getNotepadStyles(isDarkMode),
    [isDarkMode]
  );

  const normalizedTranscriptQuery = transcriptSearchQuery.trim().toLowerCase();

  // Auto-scroll to bottom when new transcription chunks arrive
  useEffect(() => {
    if (autoScrollTranscript && !autoScrollPaused && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTranscriptChunks, liveInterimTranscript, autoScrollTranscript, autoScrollPaused]);

  // Close transcript menu on outside click
  useEffect(() => {
    if (!transcriptMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!transcriptMenuRef.current) return;
      if (!transcriptMenuRef.current.contains(event.target as Node)) {
        setTranscriptMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [transcriptMenuOpen]);

  // Handle scroll in transcript panel - pause auto-scroll if user scrolls up
  const handleTranscriptPanelScroll = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const atBottom = distanceFromBottom < 60;

    if (!atBottom && autoScrollTranscript) {
      setAutoScrollPaused(true);
      return;
    }

    if (atBottom && autoScrollPaused) {
      setAutoScrollPaused(false);
    }
  }, [autoScrollTranscript, autoScrollPaused]);

  // Set auto-scroll from checkbox (also resets pause)
  const setAutoScrollFromCheckbox = useCallback((enabled: boolean) => {
    setAutoScrollTranscript(enabled);
    setAutoScrollPaused(false);
    if (enabled) {
      requestAnimationFrame(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, []);

  const handleDownloadTranscript = useCallback(
    async (format: "text" | "json") => {
      const combined = [
        ...liveTranscriptChunks.map((m) => m.segment?.text || m.text),
        ...(liveInterimTranscript ? [liveInterimTranscript] : []),
      ].filter(Boolean);
      const defaultBaseName = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}`;

      if (format === "text") {
        const content = combined.join("\n\n");
        const result = await saveTranscriptFile({
          content,
          defaultBaseName,
          extension: "txt",
          mimeType: "text/plain;charset=utf-8",
          filterName: "Text",
        });
        if (result.status === "failed") {
          alert(`Could not save transcript: ${result.error}`);
        }
        return;
      }

      const segments = liveTranscriptChunks.map((chunk) => ({
        id: chunk.segment?.id ?? `${chunk.timestamp}-${chunk.kind}`,
        text: chunk.segment?.text || chunk.text,
        timestamp: chunk.timestamp,
        kind: chunk.kind,
        engine: chunk.engine,
        scripture_references: chunk.scripture_references,
        key_points: chunk.key_points,
        paraphrased_verses: chunk.paraphrased_verses,
      }));
      const payload = {
        generatedAt: new Date().toISOString(),
        segments,
        interim: liveInterimTranscript || null,
      };
      const result = await saveTranscriptFile({
        content: JSON.stringify(payload, null, 2),
        defaultBaseName,
        extension: "json",
        mimeType: "application/json;charset=utf-8",
        filterName: "JSON",
      });
      if (result.status === "failed") {
        alert(`Could not save transcript: ${result.error}`);
      }
    },
    [liveTranscriptChunks, liveInterimTranscript]
  );

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem("liveSlidesNotepadTheme", newTheme ? "dark" : "light");
  }, [isDarkMode]);

  // Set favicon to ProAssist icon
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/ProAssist.png";
      link.type = "image/png";
    } else {
      const newLink = document.createElement("link");
      newLink.rel = "icon";
      newLink.type = "image/png";
      newLink.href = "/ProAssist.png";
      document.head.appendChild(newLink);
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const ws = new LiveSlidesWebSocket(wsUrl, sessionId, "notepad");
    wsRef.current = ws;

    ws.connect()
      .then(() => {
        setIsConnected(true);
      })
      .catch((err) => {
        console.error("Failed to connect:", err);
        setIsConnected(false);
      });

    // Listen for slides updates (from other notepads or initial state)
    const unsubscribe = ws.onSlidesUpdate((update) => {
      if (update.session_id === sessionId) {
        setSlides(update.slides);
        const currentText = textRef.current;
        const focused = document.activeElement === textareaRef.current;
        const recentlyEditedLocally =
          Date.now() - lastLocalEditAtRef.current < 800;

        // Update if different and we're not actively typing.
        // This improves main-app -> web reliability even when the textarea is focused,
        // while still preventing overwrites during active local edits.
        const shouldUpdate =
          update.raw_text !== currentText &&
          (!focused || !recentlyEditedLocally || !currentText.trim().length);

        if (shouldUpdate) {
          setText(update.raw_text);
          setBoundaries(calculateSlideBoundaries(update.raw_text));
        }
      }
    });

    const unsubscribeTranscription = ws.onMessage((message) => {
      if (message.type !== "transcription_stream") return;

      const m = message as WsTranscriptionStream;
      if (typeof m.audio_level === "number") {
        const level = Math.max(0, Math.min(1, m.audio_level));
        setAudioLevel((prev) => prev * 0.65 + level * 0.35);
      }
      if (m.kind === "interim") {
        setLiveInterimTranscript(m.text || "");
        return;
      }

      if (m.kind === "final") {
        setLiveInterimTranscript("");
        setLiveTranscriptChunks((prev) => {
          const next = [...prev, m].slice(-150);
          return next;
        });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeTranscription();
      ws.disconnect();
    };
  }, [sessionId, wsUrl]);

  // Update boundaries when text changes
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      lastLocalEditAtRef.current = Date.now();
      setText(newText);

      const newBoundaries = calculateSlideBoundaries(newText);
      setBoundaries(newBoundaries);

      // Send update to WebSocket
      if (wsRef.current && wsRef.current.isConnected) {
        wsRef.current.sendTextUpdate(newText);
      }
    },
    []
  );

  const applyTextUpdate = useCallback(
    (newText: string, selectionStart?: number, selectionEnd?: number) => {
      lastLocalEditAtRef.current = Date.now();
      setText(newText);
      setBoundaries(calculateSlideBoundaries(newText));
      if (wsRef.current && wsRef.current.isConnected) {
        wsRef.current.sendTextUpdate(newText);
      }

      if (
        textareaRef.current &&
        typeof selectionStart === "number" &&
        typeof selectionEnd === "number"
      ) {
        // Let React update the textarea value first, then restore selection.
        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.selectionStart = selectionStart;
          textareaRef.current.selectionEnd = selectionEnd;
        });
      }
    },
    []
  );

  const insertTranscriptChunkIntoNotepad = useCallback(
    (chunkText: string) => {
      // Strip leading [bracket tags] like [quote], [main point], etc.
      let cleaned = (chunkText || "").trim();
      cleaned = cleaned.replace(/^\[[^\]]*\]\s*/g, "");
      if (!cleaned) return;

      const el = textareaRef.current;
      const current = text;

      const safeStart = el?.selectionStart ?? current.length;
      const safeEnd = el?.selectionEnd ?? current.length;

      const before = current.slice(0, safeStart);
      const after = current.slice(safeEnd);

      // Find current line's indentation to preserve context
      // Look backwards from cursor to find start of current line
      const lastNewlineIdx = before.lastIndexOf("\n");
      const currentLineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
      const currentLine = before.slice(currentLineStart);
      
      // Extract leading whitespace (tabs/spaces) from current line
      const indentMatch = currentLine.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1] : "";

      // Determine insertion behavior:
      // - If we're at end of an indented line or on an empty indented line, 
      //   add text on a new line with the same indent
      // - If cursor is at end of document or after blank lines, just add normally
      const isOnIndentedLine = currentIndent.length > 0;
      const isAtEndOfLine = after.length === 0 || after.startsWith("\n");
      const lineHasContent = currentLine.trim().length > 0;

      let prefix: string;
      let textToInsert: string;

      if (isOnIndentedLine && isAtEndOfLine) {
        // Preserve indentation: add newline + same indent + text
        prefix = lineHasContent ? "\n" : "";
        textToInsert = currentIndent + cleaned;
      } else if (before.length > 0 && !before.endsWith("\n")) {
        // Not indented, mid-line or end without newline - add newline before
        prefix = "\n";
        textToInsert = cleaned;
      } else {
        // At start or already has newline
        prefix = "";
        textToInsert = cleaned;
      }

      const suffix = after.length > 0 && !after.startsWith("\n") ? "\n" : "";

      const nextValue = before + prefix + textToInsert + suffix + after;
      const nextPos = (before + prefix + textToInsert).length;

      applyTextUpdate(nextValue, nextPos, nextPos);
      el?.focus();
    },
    [applyTextUpdate, text]
  );

  // Helper to check if a line is a bullet line
  const isBulletLine = useCallback((line: string) => {
    return line.startsWith(BULLET_PREFIX) || line.startsWith(`\t${BULLET_CHAR}`) || line.startsWith(`    ${BULLET_CHAR}`);
  }, []);

  // Helper to get line start index
  const getLineStartIdx = useCallback((value: string, idx: number) => {
    const i = value.lastIndexOf("\n", Math.max(0, idx - 1));
    return i === -1 ? 0 : i + 1;
  }, []);

  // Helper to get current line
  const getCurrentLine = useCallback((value: string, cursorPos: number) => {
    const lineStart = getLineStartIdx(value, cursorPos);
    const lineEndIdx = value.indexOf("\n", cursorPos);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    return value.slice(lineStart, lineEnd);
  }, [getLineStartIdx]);

  // Toggle bullet list for current line or selection
  const toggleBulletList = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const value = el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    const lineStart = getLineStartIdx(value, start);
    const lineEndIdx = value.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");

    // Check if all selected lines are already bulleted
    const allBulleted = lines.every((line) => line.trim() === "" || isBulletLine(line));

    const newLines = lines.map((line) => {
      if (line.trim() === "") return line;
      
      if (allBulleted) {
        // Remove bullet
        if (line.startsWith(BULLET_PREFIX)) {
          return line.slice(BULLET_PREFIX.length);
        }
        if (line.startsWith(`\t${BULLET_CHAR} `)) {
          return line.slice(3);
        }
        if (line.startsWith(`    ${BULLET_CHAR} `)) {
          return line.slice(6);
        }
        // Just has tab/indent without bullet
        if (line.startsWith("\t")) return line.slice(1);
        if (line.startsWith("    ")) return line.slice(4);
        return line;
      } else {
        // Add bullet (only if not already bulleted)
        if (isBulletLine(line)) return line;
        return BULLET_PREFIX + line;
      }
    });

    const newBlock = newLines.join("\n");
    const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    const newPos = lineStart + newBlock.length;
    
    applyTextUpdate(newValue, newPos, newPos);
    el.focus();
  }, [applyTextUpdate, getLineStartIdx, isBulletLine]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      const value = el.value;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;

      const lineStart = getLineStartIdx(value, start);
      const currentLine = getCurrentLine(value, start);

      // Handle Enter key - continue bullet list
      if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (isBulletLine(currentLine)) {
          e.preventDefault();
          
          // If cursor is on an empty bullet line, remove the bullet instead
          const contentAfterBullet = currentLine.replace(/^(\t|    )• ?/, "").trim();
          if (contentAfterBullet === "") {
            // Remove the bullet line prefix and stay on regular line
            const lineEndIdx = value.indexOf("\n", start);
            const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
            const newValue = value.slice(0, lineStart) + value.slice(lineEnd);
            const newPos = lineStart;
            applyTextUpdate(newValue, newPos, newPos);
            return;
          }

          // Continue with bullet on new line
          const newValue = value.slice(0, start) + "\n" + BULLET_PREFIX + value.slice(end);
          const newPos = start + 1 + BULLET_PREFIX.length;
          applyTextUpdate(newValue, newPos, newPos);
          return;
        }
      }

      // Handle Backspace - remove bullet if at start of bullet line
      if (e.key === "Backspace" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (isBulletLine(currentLine)) {
          const posInLine = start - lineStart;
          // If cursor is right after the bullet prefix, remove the bullet
          if (posInLine <= BULLET_PREFIX.length) {
            e.preventDefault();
            // Remove just the bullet prefix, keep the content
            const content = currentLine.replace(/^(\t|    )• ?/, "");
            const lineEndIdx = value.indexOf("\n", start);
            const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
            const newValue = value.slice(0, lineStart) + content + value.slice(lineEnd);
            const newPos = lineStart;
            applyTextUpdate(newValue, newPos, newPos);
            return;
          }
        }
      }

      // Handle Tab key - create bullet list or indent
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;

      e.preventDefault();

      // Multi-line selection: indent/outdent whole lines with bullets
      const hasMultilineSelection =
        start !== end && value.slice(start, end).includes("\n");

      const outdentLine = (line: string) => {
        // Remove bullet prefix
        if (line.startsWith(BULLET_PREFIX)) {
          return line.slice(BULLET_PREFIX.length);
        }
        if (line.startsWith(`\t${BULLET_CHAR} `)) {
          return line.slice(3);
        }
        if (line.startsWith(`    ${BULLET_CHAR} `)) {
          return line.slice(6);
        }
        // Regular indent removal
        if (line.startsWith("\t")) return line.slice(1);
        if (line.startsWith("    ")) return line.slice(4);
        return line;
      };

      const indentLine = (line: string) => {
        if (line.length === 0) return line;
        // If already bulleted, just return as is
        if (isBulletLine(line)) return line;
        // Add bullet prefix
        return BULLET_PREFIX + line;
      };

      if (hasMultilineSelection || e.shiftKey) {
        const blockStart = getLineStartIdx(value, start);
        const blockEndNewline = value.indexOf("\n", end);
        const blockEnd = blockEndNewline === -1 ? value.length : blockEndNewline;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split("\n");

        const nextLines = e.shiftKey
          ? lines.map(outdentLine)
          : lines.map(indentLine);

        const newBlock = nextLines.join("\n");
        const newValue = value.slice(0, blockStart) + newBlock + value.slice(blockEnd);

        // Keep selection spanning the full modified block
        applyTextUpdate(newValue, blockStart, blockStart + newBlock.length);
        return;
      }

      // If not already a bullet line, convert to bullet (even if empty)
      if (!isBulletLine(currentLine)) {
        const lineEndIdx = value.indexOf("\n", start);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const newLine = BULLET_PREFIX + currentLine;
        const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
        const newPos = start + BULLET_PREFIX.length;
        applyTextUpdate(newValue, newPos, newPos);
        return;
      }

      // Already a bullet line: just insert tab at cursor for additional indentation
      const newValue = value.slice(0, start) + "\t" + value.slice(end);
      const newPos = start + 1;
      applyTextUpdate(newValue, newPos, newPos);
    },
    [applyTextUpdate, getLineStartIdx, getCurrentLine, isBulletLine]
  );

  // Track cursor position to detect if on bullet line
  const handleSelectionChange = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    
    const value = el.value;
    const cursorPos = el.selectionStart ?? 0;
    
    // Calculate line index
    const textBeforeCursor = value.slice(0, cursorPos);
    const lineIndex = textBeforeCursor.split("\n").length - 1;
    setCursorLineIndex(lineIndex);
  }, []);

  // Check if current line is a bullet line
  const isCurrentLineBulleted = useMemo(() => {
    const lines = text.split("\n");
    if (cursorLineIndex >= 0 && cursorLineIndex < lines.length) {
      return isBulletLine(lines[cursorLineIndex]);
    }
    return false;
  }, [text, cursorLineIndex, isBulletLine]);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    if (colorIndicatorsRef.current) {
      colorIndicatorsRef.current.scrollTop = target.scrollTop;
    }
    if (slideDividersRef.current) {
      slideDividersRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    const lines = text.split("\n");
    return lines.map((_, i) => i + 1);
  }, [text]);

  // Calculate slide divider positions (line indices where slides end)
  const slideDividerLines = useMemo(() => {
    if (boundaries.length === 0) return [];
    
    // Get unique end lines for each slide boundary (excluding the last one)
    const endLines = new Set<number>();
    for (let i = 0; i < boundaries.length - 1; i++) {
      endLines.add(boundaries[i].endLine);
    }
    
    return Array.from(endLines).sort((a, b) => a - b);
  }, [boundaries]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    } catch (err) {
      setCopyFeedback("Failed to copy");
      setTimeout(() => setCopyFeedback(""), 2000);
    }
  }, []);

  // Calculate line height for color indicators
  const lineHeight = 1.6 * 16; // 1.6rem at 16px base

  return (
    <div style={notepadStyles.container}>
      {/* Header */}
      <div style={notepadStyles.header}>
        <div style={notepadStyles.headerLeft}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>
            Live Slides
          </h1>
          <span style={notepadStyles.sessionBadge}>
            {sessionId?.slice(0, 8)}...
          </span>
          <div style={notepadStyles.connectionStatus}>
            <span
              style={{
                ...notepadStyles.statusDot,
                backgroundColor: isConnected ? "#10B981" : "#EF4444",
              }}
            />
            <span>{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <div style={notepadStyles.headerRight}>
          <button
            onClick={() => setShowHelpPopup(!showHelpPopup)}
            style={notepadStyles.helpButton}
            title="How indentation works"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#3a3a3a"
                : "#d8d8d8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#2a2a2a"
                : "#e8e8e8";
            }}
          >
            <FaQuestionCircle />
          </button>
          <button
            onClick={() => setShowLiveTranscription((v) => !v)}
            style={{
              ...notepadStyles.transcriptionToggleButton,
              backgroundColor: showLiveTranscription
                ? "#3B82F6"
                : notepadStyles.transcriptionToggleButton.backgroundColor,
              color: showLiveTranscription
                ? "white"
                : notepadStyles.transcriptionToggleButton.color,
              border: showLiveTranscription
                ? "1px solid #3B82F6"
                : notepadStyles.transcriptionToggleButton.border,
            }}
            title="Toggle live transcription panel"
            onMouseEnter={(e) => {
              if (!showLiveTranscription) {
                e.currentTarget.style.backgroundColor = isDarkMode
                  ? "#3a3a3a"
                  : "#d8d8d8";
              }
            }}
            onMouseLeave={(e) => {
              if (!showLiveTranscription) {
                e.currentTarget.style.backgroundColor = isDarkMode
                  ? "#2a2a2a"
                  : "#e8e8e8";
              }
            }}
          >
            <FaMicrophone />
            Live Transcription
          </button>
          {showHelpPopup && (
            <div style={notepadStyles.helpPopup}>
              <div style={notepadStyles.helpTitle}>How Indentation Works</div>
              <div style={notepadStyles.helpText}>
                <strong>Consecutive lines</strong> (no empty line between) = One
                slide with multiple items
              </div>
              <div style={notepadStyles.helpText}>
                <strong>Empty lines</strong> = Create new slides
              </div>
              <div style={notepadStyles.helpText}>
                <strong>Tab/Indent</strong> = Creates sub-items. The first line
                becomes a title, and each indented line creates a new slide with
                title + sub-item.
              </div>
              <div style={notepadStyles.helpExample}>
                {`this is item one on same slide
this is item two on same slide
this is item three on same slide

this is a new Slide

This is the title of all the slide below
	1. sub item using the title on top
	2. this is another sub item using the title`}
              </div>
              <button
                onClick={() => {
                  const exampleText = `this is item one on same slide
this is item two on same slide
this is item three on same slide

this is a new Slide

This is the title of all the slide below
	1. sub item using the title on top
	2. this is another sub item using the title`;
                  setText(exampleText);
                  setShowHelpPopup(false);
                  // Focus the textarea
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                    // Move cursor to end
                    const length = exampleText.length;
                    textareaRef.current.setSelectionRange(length, length);
                  }
                }}
                style={notepadStyles.helpButtonAction}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode
                    ? "#3a3a3a"
                    : "#d8d8d8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode
                    ? "#2a2a2a"
                    : "#e8e8e8";
                }}
              >
                Use This as Template
              </button>
            </div>
          )}
          <button
            onClick={toggleTheme}
            style={notepadStyles.themeToggle}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#3a3a3a"
                : "#d8d8d8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#2a2a2a"
                : "#e8e8e8";
            }}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button
            style={{
              ...notepadStyles.copyButton,
              backgroundColor: copyFeedback ? "#10B981" : undefined,
            }}
            onClick={handleCopyUrl}
            onMouseEnter={(e) => {
              if (!copyFeedback) {
                e.currentTarget.style.backgroundColor = isDarkMode
                  ? "#3a3a3a"
                  : "#d8d8d8";
              }
            }}
            onMouseLeave={(e) => {
              if (!copyFeedback) {
                e.currentTarget.style.backgroundColor = isDarkMode
                  ? "#2a2a2a"
                  : "#e8e8e8";
              }
            }}
          >
            📋 {copyFeedback || "Copy URL"}
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: notepadStyles.header.backgroundColor,
          borderBottom: `1px solid ${notepadStyles.border}`,
        }}
      >
        <button
          onClick={toggleBulletList}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: isCurrentLineBulleted
              ? "1px solid #3B82F6"
              : `1px solid ${notepadStyles.border}`,
            backgroundColor: isCurrentLineBulleted
              ? "#3B82F6"
              : notepadStyles.helpButton.backgroundColor,
            color: isCurrentLineBulleted
              ? "white"
              : notepadStyles.helpButton.color,
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 500,
            transition: "all 0.15s ease",
          }}
          title="Toggle bullet list (Tab)"
          onMouseEnter={(e) => {
            if (!isCurrentLineBulleted) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#3a3a3a"
                : "#d8d8d8";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCurrentLineBulleted) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#2a2a2a"
                : "#e8e8e8";
            }
          }}
        >
          <FaListUl />
          Bullet List
        </button>
        
        <button
          onClick={() => setShowSlideDividers(!showSlideDividers)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: showSlideDividers
              ? "1px solid #3B82F6"
              : `1px solid ${notepadStyles.border}`,
            backgroundColor: showSlideDividers
              ? "#3B82F6"
              : notepadStyles.helpButton.backgroundColor,
            color: showSlideDividers
              ? "white"
              : notepadStyles.helpButton.color,
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 500,
            transition: "all 0.15s ease",
          }}
          title="Show horizontal lines between slides"
          onMouseEnter={(e) => {
            if (!showSlideDividers) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#3a3a3a"
                : "#d8d8d8";
            }
          }}
          onMouseLeave={(e) => {
            if (!showSlideDividers) {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#2a2a2a"
                : "#e8e8e8";
            }
          }}
        >
          <FaGripLines />
          Slide Dividers
        </button>
        
        <span
          style={{
            fontSize: "0.7rem",
            color: notepadStyles.footer.color,
            marginLeft: "4px",
          }}
        >
          Press Tab to bullet • Enter to continue • Backspace to remove
        </span>
      </div>

      {/* Editor */}
      <div style={notepadStyles.editorWrapper}>
        {/* Color indicators */}
        <div
          ref={colorIndicatorsRef}
          style={{
            ...notepadStyles.colorIndicators,
            paddingTop: "16px",
            overflowY: "hidden",
          }}
        >
          {lineNumbers.map((_, idx) => {
            const boundary = boundaries.find(
              (b) => idx >= b.startLine && idx <= b.endLine
            );
            return (
              <div
                key={idx}
                style={{
                  height: `${lineHeight}px`,
                  backgroundColor: boundary?.color || "transparent",
                  transition: "background-color 0.15s ease",
                }}
              />
            );
          })}
        </div>

        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          style={{
            ...notepadStyles.lineNumbers,
            overflowY: "hidden",
          }}
        >
          {lineNumbers.map((num) => (
            <div key={num} style={{ height: `${lineHeight}px` }}>
              {num}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <div style={notepadStyles.textareaWrapper}>
          {/* Slide dividers overlay */}
          {showSlideDividers && (
            <div
              ref={slideDividersRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
                overflow: "hidden",
                paddingTop: "16px",
              }}
            >
              {lineNumbers.map((_, idx) => {
                const isDividerLine = slideDividerLines.includes(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      height: `${lineHeight}px`,
                      borderBottom: isDividerLine
                        ? `1px solid ${isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`
                        : "none",
                      boxSizing: "border-box",
                    }}
                  />
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            onSelect={handleSelectionChange}
            onScroll={handleScroll}
            style={notepadStyles.textarea}
            placeholder={`Start typing your slides here...

HOW IT WORKS:
• Empty lines create new slides
• Consecutive lines (no empty line between) = one slide with multiple items
• Tab/indent creates sub-items: first line becomes title, each indented line creates a new slide with title + sub-item

EXAMPLES:

Simple (3 lines = 1 slide with 3 items):
Line one
Line two
Line three

With tabs (creates 3 slides):
Title
	Sub-item 1
	Sub-item 2

Result: Slide 1 = Title, Slide 2 = Title + Sub-item 1, Slide 3 = Title + Sub-item 2`}
            spellCheck={false}
            autoFocus
          />
        </div>

        {/* Live transcription panel */}
        {showLiveTranscription && (
          <div style={notepadStyles.transcriptionPanel}>
            <div style={notepadStyles.transcriptionPanelHeader}>
              <div style={notepadStyles.transcriptionHeaderTopRow}>
                <div style={notepadStyles.transcriptionTitle}>
                  <FaMicrophone />
                  Live Transcriptions
                </div>
                <div style={notepadStyles.transcriptionHeaderActions}>
                  <div style={{ fontSize: "0.75rem", color: notepadStyles.footer.color }}>
                    {isConnected ? "WS connected" : "WS disconnected"}
                  </div>
                  <TranscriptOptionsMenu
                    isOpen={transcriptMenuOpen}
                    onToggle={() => setTranscriptMenuOpen((v) => !v)}
                    menuRef={transcriptMenuRef}
                    searchQuery={transcriptSearchQuery}
                    onSearchChange={setTranscriptSearchQuery}
                    onClearSearch={() => setTranscriptSearchQuery("")}
                    options={[
                      {
                        id: "show-transcript",
                        label: "Transcript",
                        checked: filterTranscript,
                        onToggle: () => setFilterTranscript((v) => !v),
                      },
                      {
                        id: "show-scripture",
                        label: "Scripture refs",
                        checked: filterReferences,
                        onToggle: () => setFilterReferences((v) => !v),
                      },
                      {
                        id: "show-key-points",
                        label: "Key points",
                        checked: filterKeyPoints,
                        onToggle: () => setFilterKeyPoints((v) => !v),
                      },
                    ]}
                    actions={[
                      {
                        id: "download-text",
                        label: "Download as text",
                        icon: <FaDownload size={12} />,
                        onClick: () => {
                          handleDownloadTranscript("text");
                          setTranscriptMenuOpen(false);
                        },
                      },
                      {
                        id: "download-json",
                        label: "Download as JSON",
                        icon: <FaDownload size={12} />,
                        onClick: () => {
                          handleDownloadTranscript("json");
                          setTranscriptMenuOpen(false);
                        },
                      },
                    ]}
                    triggerClassName="icon-button"
                    triggerStyle={{ padding: "6px" }}
                    theme={{
                      menuBg: notepadStyles.transcriptionPanel.backgroundColor,
                      menuBorder: notepadStyles.border,
                      text: notepadStyles.transcriptionTitle.color,
                      textSecondary: notepadStyles.footer.color,
                      inputBg: notepadStyles.input.background,
                      inputBorder: notepadStyles.border,
                    }}
                  />
                </div>
              </div>

              <div style={notepadStyles.transcriptionMeter}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(2, Math.round(audioLevel * 100))}%`,
                    backgroundColor:
                      audioLevel > 0.85
                        ? "rgb(220, 38, 38)"
                        : audioLevel > 0.7
                        ? "rgb(234, 179, 8)"
                        : "rgb(34, 197, 94)",
                    transition: "width 80ms linear, background-color 150ms ease",
                  }}
                />
              </div>
            </div>

            <div
              ref={transcriptScrollRef}
              onScroll={handleTranscriptPanelScroll}
              style={notepadStyles.transcriptionScroll}
            >
              {/* Auto-scroll checkbox - positioned right below separator line */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  paddingTop: "0px",
                  paddingBottom: "4px",
                  paddingRight: "0px",
                  marginTop: "-12px",
                  marginBottom: "0px",
                }}
              >
                <label
                  style={{
                    ...notepadStyles.transcriptionFilterLabel,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontSize: "0.8rem",
                    color: notepadStyles.footer.color,
                  }}
                  title="When enabled, the transcript will stay scrolled to the latest line. Scrolling up pauses it."
                >
                  <input
                    type="checkbox"
                    checked={autoScrollTranscript}
                    onChange={(e) => setAutoScrollFromCheckbox(e.target.checked)}
                  />
                  Auto-scroll
                  {autoScrollTranscript && autoScrollPaused && (
                    <span style={{ color: "#f59e0b", fontWeight: 700, marginLeft: "4px" }}>(paused)</span>
                  )}
                </label>
              </div>
              {liveTranscriptChunks.length === 0 ? (
                <div style={{ color: notepadStyles.footer.color, fontSize: "0.85rem", padding: "8px 12px" }}>
                  Waiting for transcription stream…
                  <div style={{ marginTop: "6px", fontSize: "0.78rem", opacity: 0.9 }}>
                    Enable streaming in SmartVerses Settings → Transcription Settings.
                  </div>
                </div>
              ) : (
                liveTranscriptChunks.map((m) => {
                    const showAny =
                      filterTranscript ||
                      (filterReferences && (m.scripture_references?.length || 0) > 0) ||
                      (filterKeyPoints && (m.key_points?.length || 0) > 0);

                    if (!showAny) return null;

                    const ts = new Date(m.timestamp).toLocaleTimeString();
                    const chunkText = m.segment?.text || m.text;
                    const matchesQuery =
                      !normalizedTranscriptQuery ||
                      chunkText.toLowerCase().includes(normalizedTranscriptQuery);

                    if (!matchesQuery) return null;

                    return (
                      <div
                        key={(m.segment?.id || `${m.timestamp}`) + m.kind}
                        style={notepadStyles.transcriptionChunkCard}
                      >
                        <div style={notepadStyles.transcriptionChunkTopRow}>
                          <div style={notepadStyles.transcriptionChunkMeta}>
                            {ts} · {m.engine}
                          </div>
                          {filterTranscript && (
                            <button
                              style={notepadStyles.transcriptionAddButton}
                              onClick={() => insertTranscriptChunkIntoNotepad(chunkText)}
                              title="Add this chunk to the notepad as a new slide"
                            >
                              <FaPlus /> Add
                            </button>
                          )}
                        </div>

                        {filterTranscript && (
                          <div style={notepadStyles.transcriptionChunkText}>{chunkText}</div>
                        )}

                        {filterReferences &&
                          (m.scripture_references?.length || 0) > 0 && (
                            <div style={notepadStyles.transcriptionSubsection}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: notepadStyles.footer.color,
                                }}
                              >
                                Scripture refs
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                {m.scripture_references?.map((ref, i) => (
                                  <div key={`${m.timestamp}-ref-${i}`} style={notepadStyles.scriptureCard}>
                                    <span style={notepadStyles.scriptureText}>{ref}</span>
                                    <button
                                      style={notepadStyles.scriptureAddButton}
                                      onClick={() => insertTranscriptChunkIntoNotepad(ref)}
                                      title="Add this scripture reference to the notepad"
                                    >
                                      <FaPlus size={10} /> Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {filterKeyPoints && (m.key_points?.length || 0) > 0 && (
                          <div style={notepadStyles.transcriptionSubsection}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: notepadStyles.footer.color,
                              }}
                            >
                              Key points
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              {m.key_points?.map((kp, i) => {
                                const category = kp.category?.trim();
                                return (
                                  <div key={`${m.timestamp}-kp-${i}`} style={notepadStyles.keyPointCard}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                                      {category && (
                                        <span style={notepadStyles.keyPointBadge}>{category}</span>
                                      )}
                                      <span style={notepadStyles.keyPointText}>{kp.text}</span>
                                    </div>
                                    <button
                                      style={notepadStyles.keyPointAddButton}
                                      onClick={() => insertTranscriptChunkIntoNotepad(kp.text)}
                                      title="Add this key point to the notepad"
                                    >
                                      <FaPlus size={10} /> Add
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}

              {/* Interim transcript - shown at bottom for real-time updates */}
              {filterTranscript &&
                liveInterimTranscript.trim().length > 0 &&
                (!normalizedTranscriptQuery ||
                  liveInterimTranscript.toLowerCase().includes(normalizedTranscriptQuery)) && (
                <div style={notepadStyles.transcriptionInterim}>
                  {liveInterimTranscript}
                </div>
              )}

              {/* Scroll anchor for auto-scroll */}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={notepadStyles.footer}>
        <div>
          {text.split("\n").length} lines · {slides.length || boundaries.length}{" "}
          slides
        </div>
        <div style={notepadStyles.slidesPreview}>
          {boundaries.slice(0, 8).map((boundary, idx) => (
            <div
              key={idx}
              style={{
                ...notepadStyles.slideIndicator,
                backgroundColor: boundary.color,
                color: "white",
              }}
            >
              {idx + 1}
            </div>
          ))}
          {boundaries.length > 8 && (
            <span style={{ color: notepadStyles.footer.color }}>
              +{boundaries.length - 8} more
            </span>
          )}
        </div>
        <div>
          WS: {wsHost}:{wsPort}
        </div>
      </div>

      {/* Pulse animation for status dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Click outside to close help popup */}
      {showHelpPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setShowHelpPopup(false)}
        />
      )}
    </div>
  );
};

export default LiveSlidesNotepad;
