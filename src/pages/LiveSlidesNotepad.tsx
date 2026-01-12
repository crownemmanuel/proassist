import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FaSun, FaMoon } from "react-icons/fa";
import { LiveSlidesWebSocket } from "../services/liveSlideService";
import {
  calculateSlideBoundaries,
  SlideBoundary,
} from "../utils/liveSlideParser";
import { LiveSlide } from "../types/liveSlides";
import "../App.css";

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const colorIndicatorsRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<LiveSlidesWebSocket | null>(null);

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

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem("liveSlidesNotepadTheme", newTheme ? "dark" : "light");
  }, [isDarkMode]);

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
        // Update text if it's different and we don't have focus
        // Also update if our current text is empty (initial load) to pre-populate from server
        const shouldUpdate =
          update.raw_text !== text &&
          (document.activeElement !== textareaRef.current ||
            !text.trim().length);
        if (shouldUpdate) {
          setText(update.raw_text);
          setBoundaries(calculateSlideBoundaries(update.raw_text));
        }
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [sessionId, wsUrl]);

  // Update boundaries when text changes
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Browsers use Tab for focus navigation. Intercept it so users can create
      // sub-items (lines starting with Tab) inside the notepad.
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;

      e.preventDefault();

      const el = e.currentTarget;
      const value = el.value;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;

      const TAB = "\t"; // matches parsing rules (also supports 4 spaces)

      const lineStartIdx = (idx: number) => {
        const i = value.lastIndexOf("\n", Math.max(0, idx - 1));
        return i === -1 ? 0 : i + 1;
      };

      // Multi-line selection: indent/outdent whole lines.
      const hasMultilineSelection =
        start !== end && value.slice(start, end).includes("\n");

      const outdentLine = (line: string) => {
        if (line.startsWith("\t")) return line.slice(1);
        if (line.startsWith("    ")) return line.slice(4);
        return line;
      };

      if (hasMultilineSelection || e.shiftKey) {
        const blockStart = lineStartIdx(start);
        const blockEndNewline = value.indexOf("\n", end);
        const blockEnd =
          blockEndNewline === -1 ? value.length : blockEndNewline;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split("\n");

        const nextLines = e.shiftKey
          ? lines.map(outdentLine)
          : lines.map((l) => (l.length === 0 ? l : `${TAB}${l}`));

        const newBlock = nextLines.join("\n");
        const newValue =
          value.slice(0, blockStart) + newBlock + value.slice(blockEnd);

        // Keep selection spanning the full modified block (simple + predictable).
        applyTextUpdate(newValue, blockStart, blockStart + newBlock.length);
        return;
      }

      // Single cursor: insert a tab at the caret (common editing behavior).
      const newValue = value.slice(0, start) + TAB + value.slice(end);
      const newPos = start + TAB.length;
      applyTextUpdate(newValue, newPos, newPos);
    },
    [applyTextUpdate]
  );

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    if (colorIndicatorsRef.current) {
      colorIndicatorsRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    const lines = text.split("\n");
    return lines.map((_, i) => i + 1);
  }, [text]);

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
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            style={notepadStyles.textarea}
            placeholder="Start typing your slides here...

Empty lines create new slides.
Lines starting with Tab are sub-items.

Example:
Welcome to Our Service
Today's Message

Scripture Reading
	John 3:16
	For God so loved the world..."
            spellCheck={false}
            autoFocus
          />
        </div>
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
    </div>
  );
};

export default LiveSlidesNotepad;
