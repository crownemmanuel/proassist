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
import { loadDisplayScripture, loadDisplaySettings, loadDisplaySlides, loadDisplayTimerState } from "../services/displayService";
import { formatStageAssistTime } from "../contexts/StageAssistContext";
import "../App.css";

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

const rectStyle = (rect: DisplayLayoutRect): React.CSSProperties => ({
  position: "absolute",
  left: `${rect.x * 100}%`,
  top: `${rect.y * 100}%`,
  width: `${rect.width * 100}%`,
  height: `${rect.height * 100}%`,
});

const AudienceDisplayTestWindow: React.FC = () => {
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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [isHovered, setIsHovered] = useState(false);
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

  // Load background image asynchronously
  useEffect(() => {
    const loadBackgroundImage = async () => {
      if (!settings.backgroundImagePath) {
        setBackgroundImageUrl("");
        return;
      }

      try {
        // Use read_file_as_base64 as primary method for robustness
        // convertFileSrc can have issues with asset protocol configuration or CSP
        console.log("[Display] Loading background image via base64:", settings.backgroundImagePath);
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
        
        // Fallback to convertFileSrc if base64 fails
        try {
          const convertedUrl = convertFileSrc(settings.backgroundImagePath);
          if (convertedUrl && (convertedUrl.startsWith("http://") || convertedUrl.startsWith("https://") || convertedUrl.startsWith("tauri://"))) {
             setBackgroundImageUrl(convertedUrl);
          } else {
             setBackgroundImageUrl("");
          }
        } catch (e) {
           setBackgroundImageUrl("");
        }
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

  const closeWindow = async () => {
    try {
      await invoke("close_dialog", { dialogWindow: "audience-test" });
    } catch (error) {
      console.error("Failed to close window:", error);
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      {isHovered && (
        <button
          onClick={closeWindow}
          style={{
            position: "absolute",
            bottom: "30px",
            left: "30px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            color: "white",
            border: "2px solid rgba(255, 255, 255, 0.8)",
            fontSize: "32px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            transition: "all 0.2s ease",
            padding: 0,
            lineHeight: 1,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.8)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Close Window"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default AudienceDisplayTestWindow;
