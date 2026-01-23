import React, { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAutoFontSize } from "../hooks/useAutoFontSize";
import {
  DisplayScripture,
  DisplaySettings,
  DisplayLayoutRect,
} from "../types/display";

const getFontStyle = (style: DisplaySettings["textStyle"]): React.CSSProperties => {
  const css: React.CSSProperties = {
    color: style.color,
    fontWeight: style.bold ? "bold" : "normal",
    fontStyle: style.italic ? "italic" : "normal",
  };

  // Text stroke (outline)
  if (style.stroke) {
    css.WebkitTextStroke = `${style.stroke.width}px ${style.stroke.color}`;
    // @ts-ignore - textStroke is a non-standard property but works in browsers
    css.textStroke = `${style.stroke.width}px ${style.stroke.color}`;
  }

  // Text shadow
  if (style.shadow) {
    css.textShadow = `${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`;
  }

  return css;
};
import {
  loadDisplaySettings,
  closeDisplayWindow,
} from "../services/displayService";
import {
  getLiveSlidesServerInfo,
  loadLiveSlidesSettings,
  startLiveSlidesServer,
} from "../services/liveSlideService";
import "../App.css";

const EMPTY_SCRIPTURE: DisplayScripture = { verseText: "", reference: "" };

const rectStyle = (rect: DisplayLayoutRect): React.CSSProperties => ({
  position: "absolute",
  left: `${rect.x * 100}%`,
  top: `${rect.y * 100}%`,
  width: `${rect.width * 100}%`,
  height: `${rect.height * 100}%`,
});

const AudienceDisplayPage: React.FC = () => {
  const [settings, setSettings] = useState<DisplaySettings>(() =>
    loadDisplaySettings()
  );
  const [scripture, setScripture] = useState<DisplayScripture>(EMPTY_SCRIPTURE);
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [serverRunning, setServerRunning] = useState<boolean>(true);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverStartedMessage, setServerStartedMessage] = useState(false);

  const textBoxRef = useRef<HTMLDivElement | null>(null);
  const textContentRef = useRef<HTMLDivElement | null>(null);
  const referenceBoxRef = useRef<HTMLDivElement | null>(null);
  const referenceContentRef = useRef<HTMLDivElement | null>(null);
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load background image asynchronously
  useEffect(() => {
    const loadBackgroundImage = async () => {
      if (!settings.backgroundImagePath) {
        setBackgroundImageUrl("");
        return;
      }

      try {
        // First try convertFileSrc (works for most cases)
        const convertedUrl = convertFileSrc(settings.backgroundImagePath);
        // Verify it's actually a URL and not the raw path
        if (convertedUrl && (convertedUrl.startsWith("http://") || convertedUrl.startsWith("https://") || convertedUrl.startsWith("tauri://"))) {
          setBackgroundImageUrl(convertedUrl);
          return;
        }
        
        // Fallback: Read file as base64 and convert to data URL
        console.log("[Display] convertFileSrc returned non-URL, trying base64 fallback for:", settings.backgroundImagePath);
        const base64 = await invoke<string>("read_file_as_base64", {
          filePath: settings.backgroundImagePath,
        });
        
        // Determine MIME type from file extension
        const path = settings.backgroundImagePath.toLowerCase();
        let mimeType = "image/png"; // default
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
          mimeType = "image/jpeg";
        } else if (path.endsWith(".webp")) {
          mimeType = "image/webp";
        } else if (path.endsWith(".png")) {
          mimeType = "image/png";
        }
        
        const dataUrl = `data:${mimeType};base64,${base64}`;
        setBackgroundImageUrl(dataUrl);
      } catch (error) {
        console.error("[Display] Failed to load background image:", error);
        setBackgroundImageUrl("");
      }
    };

    void loadBackgroundImage();
  }, [settings.backgroundImagePath]);

  const textFontSize = useAutoFontSize(
    textBoxRef,
    textContentRef,
    [
      scripture.verseText,
      settings.textFont,
      settings.layout.text.x,
      settings.layout.text.y,
      settings.layout.text.width,
      settings.layout.text.height,
    ],
    { minFontSize: 14, maxFontSize: 220 }
  );

  const referenceFontSize = useAutoFontSize(
    referenceBoxRef,
    referenceContentRef,
    [
      scripture.reference,
      settings.referenceFont,
      settings.layout.reference.x,
      settings.layout.reference.y,
      settings.layout.reference.width,
      settings.layout.reference.height,
    ],
    { minFontSize: 12, maxFontSize: 160 }
  );

  // Check server status
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const info = await getLiveSlidesServerInfo();
        setServerRunning(info.server_running);
      } catch (error) {
        console.error("[Display] Failed to check server status:", error);
        setServerRunning(false);
      }
    };

    void checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const setupListeners = async () => {
      const unlistenScripture = await listen<DisplayScripture>(
        "display:scripture",
        (event) => {
          setScripture(event.payload);
        }
      );
      const unlistenSettings = await listen<DisplaySettings>(
        "display:settings",
        (event) => {
          setSettings(event.payload);
        }
      );

      return () => {
        unlistenScripture();
        unlistenSettings();
      };
    };

    let cleanup: (() => void) | undefined;
    setupListeners()
      .then((unlisten) => {
        cleanup = unlisten;
      })
      .catch((error) => {
        console.warn("[Display] Failed to attach listeners:", error);
      });

    return () => {
      cleanup?.();
    };
  }, []);

  const handleStartServer = async () => {
    setIsStartingServer(true);
    try {
      const liveSlidesSettings = loadLiveSlidesSettings();
      await startLiveSlidesServer(liveSlidesSettings.serverPort);
      setServerRunning(true);
      setServerStartedMessage(true);
      // Hide the message after 2 seconds
      setTimeout(() => {
        setServerStartedMessage(false);
      }, 2000);
    } catch (error) {
      console.error("[Display] Failed to start server:", error);
    } finally {
      setIsStartingServer(false);
    }
  };

  // Handle mouse movement to show close button after ~2 seconds of movement
  useEffect(() => {
    let movementStartTime: number | null = null;
    const MOVEMENT_THRESHOLD_MS = 2000; // Show button after 2 seconds
    const STILL_THRESHOLD_MS = 1000; // Hide if mouse stops for 1 second

    const handleMouseMove = () => {
      const now = Date.now();
      
      // Start tracking movement time if not already started
      if (movementStartTime === null) {
        movementStartTime = now;
      }

      // Clear any existing timeout
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }

      // Check if we've been moving for 2 seconds
      const movementDuration = now - movementStartTime;
      if (movementDuration >= MOVEMENT_THRESHOLD_MS) {
        setShowCloseButton(true);
      }

      // If mouse stops moving for 1 second, hide button and reset
      mouseMoveTimeoutRef.current = setTimeout(() => {
        movementStartTime = null;
        setShowCloseButton(false);
      }, STILL_THRESHOLD_MS);
    };

    // Hide button when mouse leaves the window
    const handleMouseLeave = () => {
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
        mouseMoveTimeoutRef.current = null;
      }
      movementStartTime = null;
      // Keep button visible briefly after leaving, then hide
      setTimeout(() => {
        setShowCloseButton(false);
      }, 1500);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = async () => {
    try {
      await closeDisplayWindow();
    } catch (error) {
      console.error("[Display] Failed to close window:", error);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: settings.backgroundColor,
        backgroundImage: backgroundImageUrl
          ? `url(${backgroundImageUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflow: "hidden",
        color: "#ffffff",
      }}
    >
      {scripture.verseText && (
        <div
          ref={textBoxRef}
          style={{
            ...rectStyle(settings.layout.text),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "8px",
          }}
        >
          <div
            ref={textContentRef}
            style={{
              fontFamily: settings.textFont,
              fontSize: `${textFontSize}px`,
              lineHeight: 1.2,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              width: "100%",
              ...getFontStyle(settings.textStyle),
            }}
          >
            {scripture.verseText}
          </div>
        </div>
      )}

      {scripture.reference && (
        <div
          ref={referenceBoxRef}
          style={{
            ...rectStyle(settings.layout.reference),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "6px",
          }}
        >
          <div
            ref={referenceContentRef}
            style={{
              fontFamily: settings.referenceFont,
              fontSize: `${referenceFontSize}px`,
              lineHeight: 1.1,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              width: "100%",
              ...getFontStyle(settings.referenceStyle),
            }}
          >
            {scripture.reference}
          </div>
        </div>
      )}

      {/* Start Server button - shows when server is not running */}
      {!serverRunning && !serverStartedMessage && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10001,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <button
            onClick={handleStartServer}
            disabled={isStartingServer}
            style={{
              padding: "12px 24px",
              backgroundColor: isStartingServer ? "#6b7280" : "#8b5cf6",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: isStartingServer ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            }}
          >
            {isStartingServer ? "Starting..." : "Start Server"}
          </button>
        </div>
      )}

      {/* Server Started message - shows briefly after starting */}
      {serverStartedMessage && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10001,
            padding: "16px 32px",
            backgroundColor: "rgba(34, 197, 94, 0.9)",
            color: "#ffffff",
            borderRadius: "8px",
            fontSize: "18px",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          Server Started
        </div>
      )}

      {/* Close button - appears after mouse movement */}
      {showCloseButton && (
        <button
          onClick={handleClose}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            border: "2px solid rgba(255, 255, 255, 0.8)",
            color: "#ffffff",
            fontSize: "24px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            opacity: 0.7,
            transition: "opacity 0.2s, background-color 0.2s",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
          title="Close Audience Display"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default AudienceDisplayPage;
