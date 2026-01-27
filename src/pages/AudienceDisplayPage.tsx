import React, { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAutoFontSize } from "../hooks/useAutoFontSize";
import {
  DisplayScripture,
  DisplaySettings,
  DisplayLayoutRect,
  DisplaySlides,
  DisplayTimerState,
} from "../types/display";
import { formatStageAssistTime } from "../contexts/StageAssistContext";

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
  loadDisplayScripture,
  loadDisplaySlides,
  loadDisplayTimerState,
} from "../services/displayService";
import "../App.css";

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
  const [scripture, setScripture] = useState<DisplayScripture>(() =>
    loadDisplayScripture()
  );
  const [slides, setSlides] = useState<DisplaySlides>(() =>
    loadDisplaySlides()
  );
  const [timerState, setTimerState] = useState<DisplayTimerState>(() =>
    loadDisplayTimerState()
  );
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const textBoxRef = useRef<HTMLDivElement | null>(null);
  const textContentRef = useRef<HTMLDivElement | null>(null);
  const referenceBoxRef = useRef<HTMLDivElement | null>(null);
  const referenceContentRef = useRef<HTMLDivElement | null>(null);
  const slideLineBoxRefs = [
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
  ];
  const slideLineContentRefs = [
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
  ];
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const slideLineFontSizes = [
    useAutoFontSize(
      slideLineBoxRefs[0],
      slideLineContentRefs[0],
      [
        slides.lines[0] || "",
        settings.textFont,
        settings.slidesLayout[0]?.x,
        settings.slidesLayout[0]?.y,
        settings.slidesLayout[0]?.width,
        settings.slidesLayout[0]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
    useAutoFontSize(
      slideLineBoxRefs[1],
      slideLineContentRefs[1],
      [
        slides.lines[1] || "",
        settings.textFont,
        settings.slidesLayout[1]?.x,
        settings.slidesLayout[1]?.y,
        settings.slidesLayout[1]?.width,
        settings.slidesLayout[1]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
    useAutoFontSize(
      slideLineBoxRefs[2],
      slideLineContentRefs[2],
      [
        slides.lines[2] || "",
        settings.textFont,
        settings.slidesLayout[2]?.x,
        settings.slidesLayout[2]?.y,
        settings.slidesLayout[2]?.width,
        settings.slidesLayout[2]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
    useAutoFontSize(
      slideLineBoxRefs[3],
      slideLineContentRefs[3],
      [
        slides.lines[3] || "",
        settings.textFont,
        settings.slidesLayout[3]?.x,
        settings.slidesLayout[3]?.y,
        settings.slidesLayout[3]?.width,
        settings.slidesLayout[3]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
    useAutoFontSize(
      slideLineBoxRefs[4],
      slideLineContentRefs[4],
      [
        slides.lines[4] || "",
        settings.textFont,
        settings.slidesLayout[4]?.x,
        settings.slidesLayout[4]?.y,
        settings.slidesLayout[4]?.width,
        settings.slidesLayout[4]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
    useAutoFontSize(
      slideLineBoxRefs[5],
      slideLineContentRefs[5],
      [
        slides.lines[5] || "",
        settings.textFont,
        settings.slidesLayout[5]?.x,
        settings.slidesLayout[5]?.y,
        settings.slidesLayout[5]?.width,
        settings.slidesLayout[5]?.height,
      ],
      { minFontSize: 14, maxFontSize: 180 }
    ),
  ];

  useEffect(() => {
    const setupListeners = async () => {
      const unlistenScripture = await listen<DisplayScripture>(
        "display:scripture",
        (event) => {
          setScripture(event.payload);
        }
      );
      const unlistenSlides = await listen<DisplaySlides>(
        "display:slides",
        (event) => {
          setSlides(event.payload);
        }
      );
      const unlistenTimer = await listen<DisplayTimerState>(
        "display:timer",
        (event) => {
          setTimerState(event.payload);
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
        unlistenSlides();
        unlistenTimer();
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

      // Clear any existing timeouts
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
        mouseLeaveTimeoutRef.current = null;
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
      // Clear any existing mouse leave timeout
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
      }
      movementStartTime = null;
      // Keep button visible briefly after leaving, then hide
      mouseLeaveTimeoutRef.current = setTimeout(() => {
        setShowCloseButton(false);
        mouseLeaveTimeoutRef.current = null;
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
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
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

  const hasSlideContent = slides.lines.some((line) => line.trim());
  const shouldShowTimer =
    settings.showTimer && (timerState.isRunning || timerState.timeLeft !== 0);

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
      {hasSlideContent &&
        settings.slidesLayout.slice(0, 6).map((rect, index) => {
          const content = slides.lines[index] || "";
          if (!content.trim()) return null;
          return (
            <div
              key={`slide-line-${index}`}
              ref={slideLineBoxRefs[index]}
              style={{
                ...rectStyle(rect),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "8px",
              }}
            >
              <div
                ref={slideLineContentRefs[index]}
                style={{
                  fontFamily: settings.textFont,
                  fontSize: `${slideLineFontSizes[index]}px`,
                  lineHeight: 1.2,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  width: "100%",
                  ...getFontStyle(settings.textStyle),
                }}
              >
                {content}
              </div>
            </div>
          );
        })}

      {!hasSlideContent && scripture.verseText && (
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

      {!hasSlideContent && scripture.reference && (
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

      {shouldShowTimer && (
        <div
          style={{
            position: "absolute",
            right: "28px",
            bottom: "24px",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "#ffffff",
            fontSize: `${settings.timerFontSize}px`,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {formatStageAssistTime(timerState.timeLeft)}
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
