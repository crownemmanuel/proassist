/**
 * SmartVasis Page
 * 
 * AI-powered Bible lookup page with:
 * - Left column: Bible search chatbox
 * - Right column: Live transcription panel
 * 
 * Features:
 * - Direct Bible reference parsing (John 3:16)
 * - AI-powered paraphrase detection
 * - Live transcription with Bible verse detection
 * - Go Live functionality to ProPresenter
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaMicrophone, FaStop, FaPaperPlane, FaRobot, FaPlay, FaSearch, FaChevronDown, FaChevronUp, FaTrash } from "react-icons/fa";
import {
  SmartVasisSettings,
  SmartVasisChatMessage,
  DetectedBibleReference,
  TranscriptionStatus,
  TranscriptionSegment,
  DEFAULT_SMART_VASIS_SETTINGS,
  SMART_VASIS_SETTINGS_KEY,
  SMART_VASIS_CHAT_HISTORY_KEY,
} from "../types/smartVasis";
import { AppSettings } from "../types";
import {
  detectAndLookupReferences,
  resetParseContext,
  getVerseNavigation,
  loadVerseByComponents,
} from "../services/smartVasisBibleService";
import {
  AssemblyAITranscriptionService,
  loadSmartVasisSettings,
} from "../services/transcriptionService";
import {
  analyzeTranscriptChunk,
  searchBibleWithAI,
  resolveParaphrasedVerses,
} from "../services/smartVasisAIService";
import { searchBibleTextAsReferences } from "../services/bibleTextSearchService";
import { triggerPresentationOnConnections } from "../services/propresenterService";
import "../App.css";

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function loadAppSettings(): AppSettings {
  try {
    // Use the correct storage key that matches aiConfig.ts
    const stored = localStorage.getItem("proassist_app_settings");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to load app settings:", err);
  }
  return { theme: "dark" };
}

function loadChatHistory(): SmartVasisChatMessage[] {
  try {
    const stored = localStorage.getItem(SMART_VASIS_CHAT_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
  return [];
}

function saveChatHistory(history: SmartVasisChatMessage[]): void {
  try {
    // Keep only last 100 messages
    const trimmed = history.slice(-100);
    localStorage.setItem(SMART_VASIS_CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Failed to save chat history:", err);
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const SmartVasisPage: React.FC = () => {
  // Settings
  const [settings, setSettings] = useState<SmartVasisSettings>(DEFAULT_SMART_VASIS_SETTINGS);
  const [appSettings, setAppSettings] = useState<AppSettings>({ theme: "dark" });

  // Chat state
  const [chatHistory, setChatHistory] = useState<SmartVasisChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAISearchEnabled, setIsAISearchEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Transcription state
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptionSegment[]>([]);
  const [detectedReferences, setDetectedReferences] = useState<DetectedBibleReference[]>([]);
  const transcriptionServiceRef = useRef<AssemblyAITranscriptionService | null>(null);

  // Live state - tracks which reference is currently live (only one at a time)
  const [liveReferenceId, setLiveReferenceId] = useState<string | null>(null);

  // UI refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  // Function to reload all settings
  const reloadSettings = useCallback(() => {
    const smartVasisSettings = loadSmartVasisSettings();
    const appSettingsData = loadAppSettings();
    
    // Debug: Log the actual settings
    console.log("[SmartVasis] SmartVasis Settings:", JSON.stringify({
      provider: smartVasisSettings.bibleSearchProvider,
      model: smartVasisSettings.bibleSearchModel,
      enableAISearch: smartVasisSettings.enableAISearch,
    }));
    console.log("[SmartVasis] App Settings:", JSON.stringify({
      defaultProvider: appSettingsData.defaultAIProvider,
      hasOpenAIKey: !!appSettingsData.openAIConfig?.apiKey,
      hasGeminiKey: !!appSettingsData.geminiConfig?.apiKey,
      hasGroqKey: !!appSettingsData.groqConfig?.apiKey,
    }));
    
    setSettings(smartVasisSettings);
    setAppSettings(appSettingsData);
  }, []);

  useEffect(() => {
    // Load settings
    reloadSettings();
    setChatHistory(loadChatHistory());

    // Listen for settings changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SMART_VASIS_SETTINGS_KEY || e.key === "proassist_app_settings") {
        reloadSettings();
      }
    };
    
    // Listen for custom settings changed event (from same tab)
    const handleSettingsChanged = () => {
      console.log("[SmartVasis] Settings changed event received");
      reloadSettings();
    };
    
    // Reload settings when window regains focus (catches same-tab settings changes)
    const handleFocus = () => {
      reloadSettings();
    };
    
    // Also reload when visibility changes (tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadSettings();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("smartvasis-settings-changed", handleSettingsChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("smartvasis-settings-changed", handleSettingsChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Cleanup transcription on unmount
      if (transcriptionServiceRef.current) {
        transcriptionServiceRef.current.stopTranscription();
      }
    };
  }, [reloadSettings]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptHistory, interimTranscript]);

  // Save chat history when it changes
  useEffect(() => {
    saveChatHistory(chatHistory);
  }, [chatHistory]);

  // =============================================================================
  // BIBLE SEARCH HANDLERS
  // =============================================================================

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    const queryMessage: SmartVasisChatMessage = {
      id: `query-${Date.now()}`,
      type: "query",
      content: query,
      timestamp: Date.now(),
    };

    setChatHistory(prev => [...prev, queryMessage]);
    setInputValue("");
    setIsSearching(true);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setChatHistory(prev => [...prev, {
      id: loadingId,
      type: "result",
      content: "Searching...",
      timestamp: Date.now(),
      isLoading: true,
    }]);

    try {
      // STEP 1: Try direct Bible reference parsing (bcv_parser)
      // This handles: "John 3:16", "John 3:1-4, Romans 3:3", etc.
      console.log("🔍 Step 1: Direct reference parsing for:", query);
      let references = await detectAndLookupReferences(query);
      console.log("🔍 Direct parsing found:", references.length, "references");
      
      let searchMethod = "direct";

      // STEP 2: If no direct references found, try secondary search
      if (references.length === 0) {
        if (isAISearchEnabled) {
          // Check if AI is properly configured
          const provider = settings.bibleSearchProvider || appSettings.defaultAIProvider;
          const model = settings.bibleSearchModel;
          
          // Check for API key based on provider
          let hasApiKey = false;
          if (provider === 'openai') hasApiKey = !!appSettings.openAIConfig?.apiKey;
          else if (provider === 'gemini') hasApiKey = !!appSettings.geminiConfig?.apiKey;
          else if (provider === 'groq') hasApiKey = !!appSettings.groqConfig?.apiKey;
          
          if (provider && hasApiKey) {
            // Use AI search with configured provider/model
            console.log("🤖 Step 2: AI search with", provider, model || "(default model)");
            searchMethod = "ai";
            references = await searchBibleWithAI(
              query, 
              appSettings,
              provider as 'openai' | 'gemini' | 'groq',
              model
            );
            console.log("🤖 AI search found:", references.length, "references");
          } else {
            console.warn("⚠️ AI search enabled but not configured. Provider:", provider, "Has API key:", hasApiKey);
            // Fall back to text search
            console.log("📝 Falling back to text search (AI not properly configured)");
            searchMethod = "text";
            references = await searchBibleTextAsReferences(query, 5);
            console.log("📝 Text search found:", references.length, "references");
          }
        } else {
          // Use text search (FlexSearch) as fallback
          console.log("📝 Step 2: Text search (AI disabled)");
          searchMethod = "text";
          references = await searchBibleTextAsReferences(query, 5);
          console.log("📝 Text search found:", references.length, "references");
        }
      }

      // Remove loading message and add result
      setChatHistory(prev => {
        const filtered = prev.filter(m => m.id !== loadingId);
        if (references.length > 0) {
          return [...filtered, {
            id: `result-${Date.now()}`,
            type: "result",
            content: `Found ${references.length} verse${references.length > 1 ? "s" : ""}`,
            timestamp: Date.now(),
            references,
          }];
        } else {
          // Build helpful error message
          let errorMsg = "No verses found for your search.";
          if (!isAISearchEnabled) {
            errorMsg += " Try enabling AI Search below for better results.";
          } else if (searchMethod === "text") {
            errorMsg += " AI Search is enabled but not configured. Go to Settings → SmartVasis to configure your AI provider.";
          } else {
            errorMsg += " Try a different query or check the spelling.";
          }
          
          return [...filtered, {
            id: `result-${Date.now()}`,
            type: "result",
            content: errorMsg,
            timestamp: Date.now(),
            error: "No results",
          }];
        }
      });
    } catch (error) {
      console.error("Search error:", error);
      setChatHistory(prev => {
        const filtered = prev.filter(m => m.id !== loadingId);
        return [...filtered, {
          id: `error-${Date.now()}`,
          type: "result",
          content: "An error occurred while searching.",
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : "Unknown error",
        }];
      });
    } finally {
      setIsSearching(false);
    }
  }, [isAISearchEnabled, appSettings, settings]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch(inputValue);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear all chat history?")) {
      setChatHistory([]);
      resetParseContext();
    }
  };

  // =============================================================================
  // GO LIVE FUNCTIONALITY
  // =============================================================================

  const handleGoLive = useCallback(async (reference: DetectedBibleReference) => {
    console.log("Going live with:", reference);

    // Set this reference as live (clears any previous live reference)
    setLiveReferenceId(reference.id);

    try {
      // Write verse text to file
      if (settings.bibleOutputPath && settings.bibleTextFileName) {
        const textFilePath = `${settings.bibleOutputPath.replace(/\/?$/, "/")}${settings.bibleTextFileName}`;
        await invoke("write_text_to_file", {
          filePath: textFilePath,
          content: reference.verseText,
        });
      }

      // Write reference to file
      if (settings.bibleOutputPath && settings.bibleReferenceFileName) {
        const refFilePath = `${settings.bibleOutputPath.replace(/\/?$/, "/")}${settings.bibleReferenceFileName}`;
        await invoke("write_text_to_file", {
          filePath: refFilePath,
          content: reference.displayRef,
        });
      }

      // Trigger ProPresenter if configured
      if (settings.proPresenterActivation) {
        const { presentationUuid, slideIndex } = settings.proPresenterActivation;
        await triggerPresentationOnConnections(
          { presentationUuid, slideIndex },
          settings.proPresenterConnectionIds,
          1,
          100
        );
      }

      // Add system message
      setChatHistory(prev => [...prev, {
        id: `live-${Date.now()}`,
        type: "system",
        content: `📺 Went live: ${reference.displayRef}`,
        timestamp: Date.now(),
      }]);

      // Clear text after delay if configured
      if (settings.clearTextAfterLive && settings.bibleOutputPath) {
        setTimeout(async () => {
          if (settings.bibleTextFileName) {
            const textFilePath = `${settings.bibleOutputPath!.replace(/\/?$/, "/")}${settings.bibleTextFileName}`;
            await invoke("write_text_to_file", {
              filePath: textFilePath,
              content: "",
            });
          }
          if (settings.bibleReferenceFileName) {
            const refFilePath = `${settings.bibleOutputPath!.replace(/\/?$/, "/")}${settings.bibleReferenceFileName}`;
            await invoke("write_text_to_file", {
              filePath: refFilePath,
              content: "",
            });
          }
          // Clear live state when text is cleared
          setLiveReferenceId(null);
        }, settings.clearTextDelay || 0);
      }
    } catch (error) {
      console.error("Error going live:", error);
    }
  }, [settings]);

  // =============================================================================
  // TRANSCRIPTION HANDLERS
  // =============================================================================

  const handleStartTranscription = useCallback(async () => {
    if (!settings.assemblyAIApiKey) {
      alert("Please configure your AssemblyAI API key in Settings > SmartVasis");
      return;
    }

    setTranscriptionStatus("connecting");

    try {
      const service = new AssemblyAITranscriptionService(
        settings.assemblyAIApiKey,
        {
          onInterimTranscript: (text) => {
            setInterimTranscript(text);
          },
          onFinalTranscript: async (text, segment) => {
            setTranscriptHistory(prev => [...prev, segment]);
            setInterimTranscript("");

            // Detect Bible references in the transcript
            const directRefs = await detectAndLookupReferences(text);
            
            if (directRefs.length > 0) {
              setDetectedReferences(prev => [...prev, ...directRefs]);
              
              // Add to chat history if enabled
              if (settings.autoAddDetectedToHistory) {
                setChatHistory(prev => [...prev, {
                  id: `transcript-${Date.now()}`,
                  type: "result",
                  content: `Detected from transcription`,
                  timestamp: Date.now(),
                  references: directRefs,
                }]);
              }

              // Auto-trigger if enabled
              if (settings.autoTriggerOnDetection && directRefs.length > 0) {
                handleGoLive(directRefs[0]);
              }
            } else if (settings.enableParaphraseDetection) {
              // Try AI paraphrase detection
              const analysis = await analyzeTranscriptChunk(
                text,
                appSettings,
                true,
                settings.enableKeyPointExtraction
              );

              if (analysis.paraphrasedVerses.length > 0) {
                const resolvedRefs = await resolveParaphrasedVerses(analysis.paraphrasedVerses);
                if (resolvedRefs.length > 0) {
                  setDetectedReferences(prev => [...prev, ...resolvedRefs]);
                  
                  if (settings.autoAddDetectedToHistory) {
                    setChatHistory(prev => [...prev, {
                      id: `paraphrase-${Date.now()}`,
                      type: "result",
                      content: `Paraphrase detected (${Math.round((resolvedRefs[0].confidence || 0) * 100)}% confidence)`,
                      timestamp: Date.now(),
                      references: resolvedRefs,
                    }]);
                  }
                }
              }
            }
          },
          onError: (error) => {
            console.error("Transcription error:", error);
            setTranscriptionStatus("error");
          },
          onStatusChange: (status) => {
            setTranscriptionStatus(status);
          },
          onConnectionClose: () => {
            setTranscriptionStatus("idle");
          },
        }
      );

      if (settings.selectedMicrophoneId) {
        service.setMicrophone(settings.selectedMicrophoneId);
      }

      await service.startTranscription();
      transcriptionServiceRef.current = service;
    } catch (error) {
      console.error("Failed to start transcription:", error);
      setTranscriptionStatus("error");
      alert(`Failed to start transcription: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [settings, appSettings, handleGoLive]);

  const handleStopTranscription = useCallback(async () => {
    if (transcriptionServiceRef.current) {
      await transcriptionServiceRef.current.stopTranscription();
      transcriptionServiceRef.current = null;
    }
    setTranscriptionStatus("idle");
    setInterimTranscript("");
  }, []);

  const handleClearTranscript = () => {
    setTranscriptHistory([]);
    setDetectedReferences([]);
    setInterimTranscript("");
  };

  // =============================================================================
  // VERSE NAVIGATION STATE
  // =============================================================================

  const [verseNavigation, setVerseNavigation] = useState<Record<string, {
    hasPrevious: boolean;
    hasNext: boolean;
    previous: { book: string; chapter: number; verse: number; displayRef: string } | null;
    next: { book: string; chapter: number; verse: number; displayRef: string } | null;
  }>>({});

  // Load navigation info when a reference is displayed
  const loadNavigationInfo = useCallback(async (ref: DetectedBibleReference) => {
    if (!ref.book || !ref.chapter || !ref.verse) return;
    
    const navKey = `${ref.book}-${ref.chapter}-${ref.verse}`;
    if (verseNavigation[navKey]) return; // Already loaded
    
    const nav = await getVerseNavigation(ref.book, ref.chapter, ref.verse);
    setVerseNavigation(prev => ({
      ...prev,
      [navKey]: nav,
    }));
  }, [verseNavigation]);

  // Handle navigating to previous verse - prepends to the same message's references
  const handlePreviousVerse = useCallback(async (ref: DetectedBibleReference, messageId: string) => {
    if (!ref.book || !ref.chapter || !ref.verse) return;
    
    const navKey = `${ref.book}-${ref.chapter}-${ref.verse}`;
    const nav = verseNavigation[navKey];
    if (!nav?.previous) return;
    
    const prevVerse = await loadVerseByComponents(
      nav.previous.book,
      nav.previous.chapter,
      nav.previous.verse
    );
    
    if (prevVerse) {
      const newRef: DetectedBibleReference = {
        id: `nav-prev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reference: prevVerse.displayRef,
        displayRef: prevVerse.displayRef,
        verseText: prevVerse.verseText,
        source: 'direct',
        timestamp: Date.now(),
        book: prevVerse.book,
        chapter: prevVerse.chapter,
        verse: prevVerse.verse,
        isNavigationResult: true, // Mark as navigation result - no nav buttons
      };
      
      // Prepend to the same message's references
      setChatHistory(prev => prev.map(msg => {
        if (msg.id === messageId && msg.references) {
          return {
            ...msg,
            references: [newRef, ...msg.references],
          };
        }
        return msg;
      }));
    }
  }, [verseNavigation]);

  // Handle navigating to next verse - appends to the same message's references
  const handleNextVerse = useCallback(async (ref: DetectedBibleReference, messageId: string) => {
    if (!ref.book || !ref.chapter || !ref.verse) return;
    
    const navKey = `${ref.book}-${ref.chapter}-${ref.verse}`;
    const nav = verseNavigation[navKey];
    if (!nav?.next) return;
    
    const nextVerse = await loadVerseByComponents(
      nav.next.book,
      nav.next.chapter,
      nav.next.verse
    );
    
    if (nextVerse) {
      const newRef: DetectedBibleReference = {
        id: `nav-next-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reference: nextVerse.displayRef,
        displayRef: nextVerse.displayRef,
        verseText: nextVerse.verseText,
        source: 'direct',
        timestamp: Date.now(),
        book: nextVerse.book,
        chapter: nextVerse.chapter,
        verse: nextVerse.verse,
        isNavigationResult: true, // Mark as navigation result - no nav buttons
      };
      
      // Append to the same message's references
      setChatHistory(prev => prev.map(msg => {
        if (msg.id === messageId && msg.references) {
          return {
            ...msg,
            references: [...msg.references, newRef],
          };
        }
        return msg;
      }));
    }
  }, [verseNavigation]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  // Render a single verse card (no navigation buttons - those are at container level)
  const renderVerseCard = (ref: DetectedBibleReference, showGoLive: boolean = true) => {
    const isParaphrase = ref.source === "paraphrase";
    const borderColor = isParaphrase 
      ? settings.paraphraseReferenceColor 
      : settings.directReferenceColor;
    const isLive = liveReferenceId === ref.id;

    return (
      <div
        key={ref.id}
        style={{
          padding: "var(--spacing-3)",
          borderRadius: "8px",
          backgroundColor: "var(--app-header-bg)",
          border: `2px solid ${isLive ? "#22c55e" : borderColor}`,
          marginBottom: "var(--spacing-2)",
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--spacing-2)",
        }}>
          <div style={{
            fontWeight: 600,
            color: isLive ? "#22c55e" : borderColor,
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-2)",
          }}>
            {ref.displayRef}
            {isParaphrase && ref.confidence && (
              <span style={{
                fontSize: "0.75rem",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                color: settings.paraphraseReferenceColor,
              }}>
                {Math.round(ref.confidence * 100)}%
              </span>
            )}
          </div>
          {showGoLive && (
            <button
              onClick={() => !isLive && handleGoLive(ref)}
              className={isLive ? "" : "primary"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isLive ? "default" : "pointer",
                backgroundColor: isLive ? "#22c55e" : undefined,
                color: isLive ? "white" : undefined,
                border: isLive ? "none" : undefined,
              }}
            >
              {isLive ? (
                <>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "white",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                  Live
                </>
              ) : (
                <>
                  <FaPlay size={10} />
                  Go Live
                </>
              )}
            </button>
          )}
        </div>
        <p style={{
          margin: 0,
          fontSize: "0.9rem",
          lineHeight: 1.5,
          color: "var(--app-text-color)",
        }}>
          {ref.verseText}
        </p>
        {isParaphrase && ref.matchedPhrase && (
          <p style={{
            margin: "var(--spacing-2) 0 0",
            fontSize: "0.8rem",
            fontStyle: "italic",
            color: "var(--app-text-color-secondary)",
          }}>
            Matched: "{ref.matchedPhrase}"
          </p>
        )}
      </div>
    );
  };

  // Render a group of references with navigation at top and bottom
  const renderReferencesWithNavigation = (
    references: DetectedBibleReference[],
    messageId: string,
    showGoLive: boolean = true
  ) => {
    if (!references || references.length === 0) return null;

    const firstRef = references[0];
    const lastRef = references[references.length - 1];

    // Load navigation info for first and last verses
    if (firstRef.book && firstRef.chapter && firstRef.verse) {
      loadNavigationInfo(firstRef);
    }
    if (lastRef.book && lastRef.chapter && lastRef.verse && lastRef.id !== firstRef.id) {
      loadNavigationInfo(lastRef);
    }

    const firstNavKey = firstRef.book && firstRef.chapter && firstRef.verse 
      ? `${firstRef.book}-${firstRef.chapter}-${firstRef.verse}` 
      : null;
    const lastNavKey = lastRef.book && lastRef.chapter && lastRef.verse 
      ? `${lastRef.book}-${lastRef.chapter}-${lastRef.verse}` 
      : null;

    const firstNav = firstNavKey ? verseNavigation[firstNavKey] : null;
    const lastNav = lastNavKey ? verseNavigation[lastNavKey] : null;

    const borderColor = settings.directReferenceColor;

    return (
      <div>
        {/* Previous Verse Navigation - based on first verse */}
        {firstNav?.hasPrevious && (
          <button
            onClick={() => handlePreviousVerse(firstRef, messageId)}
            style={{
              width: "100%",
              padding: "var(--spacing-2)",
              marginBottom: "var(--spacing-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-2)",
              backgroundColor: "transparent",
              border: "1px dashed var(--app-border-color)",
              borderRadius: "8px",
              color: "var(--app-text-color-secondary)",
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-header-bg)";
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.color = borderColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "var(--app-border-color)";
              e.currentTarget.style.color = "var(--app-text-color-secondary)";
            }}
          >
            <FaChevronUp size={12} />
            <span>Previous Verse</span>
          </button>
        )}

        {/* All verse cards */}
        {references.map((ref) => renderVerseCard(ref, showGoLive))}

        {/* Next Verse Navigation - based on last verse */}
        {lastNav?.hasNext && (
          <button
            onClick={() => handleNextVerse(lastRef, messageId)}
            style={{
              width: "100%",
              padding: "var(--spacing-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-2)",
              backgroundColor: "transparent",
              border: "1px dashed var(--app-border-color)",
              borderRadius: "8px",
              color: "var(--app-text-color-secondary)",
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-header-bg)";
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.color = borderColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "var(--app-border-color)";
              e.currentTarget.style.color = "var(--app-text-color-secondary)";
            }}
          >
            <FaChevronDown size={12} />
            <span>Next Verse</span>
          </button>
        )}
      </div>
    );
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - 60px)",
      gap: "var(--spacing-4)",
      padding: "var(--spacing-4)",
    }}>
      {/* LEFT COLUMN - Bible Search Chat */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--app-bg-color)",
        borderRadius: "12px",
        border: "1px solid var(--app-border-color)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "var(--spacing-3) var(--spacing-4)",
          borderBottom: "1px solid var(--app-border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--app-header-bg)",
        }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
            <FaSearch />
            Bible Search
          </h3>
          <button
            onClick={handleClearHistory}
            className="icon-button"
            title="Clear history"
            style={{ padding: "6px" }}
          >
            <FaTrash size={12} />
          </button>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-4)",
        }}>
          {chatHistory.length === 0 ? (
            <div style={{
              textAlign: "center",
              color: "var(--app-text-color-secondary)",
              padding: "var(--spacing-8)",
            }}>
              <FaSearch size={32} style={{ marginBottom: "var(--spacing-3)", opacity: 0.5 }} />
              <p>Search for Bible verses</p>
              <p style={{ fontSize: "0.85rem" }}>
                Type a reference like "John 3:16" or a phrase like "For God so loved"
              </p>
            </div>
          ) : (
            chatHistory.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: "var(--spacing-3)",
                }}
              >
                {message.type === "query" && (
                  <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: "var(--spacing-2)",
                  }}>
                    <div style={{
                      backgroundColor: "var(--app-primary-color)",
                      color: "white",
                      padding: "var(--spacing-2) var(--spacing-3)",
                      borderRadius: "12px 12px 0 12px",
                      maxWidth: "80%",
                    }}>
                      {message.content}
                    </div>
                  </div>
                )}
                {message.type === "result" && (
                  <div>
                    {message.isLoading ? (
                      <div style={{
                        padding: "var(--spacing-3)",
                        color: "var(--app-text-color-secondary)",
                        fontStyle: "italic",
                      }}>
                        {message.content}
                      </div>
                    ) : message.references && message.references.length > 0 ? (
                      <>
                        <p style={{
                          fontSize: "0.8rem",
                          color: "var(--app-text-color-secondary)",
                          marginBottom: "var(--spacing-2)",
                        }}>
                          {message.content}
                        </p>
                        {renderReferencesWithNavigation(message.references, message.id, true)}
                      </>
                    ) : (
                      <div style={{
                        padding: "var(--spacing-3)",
                        color: message.error ? "var(--error)" : "var(--app-text-color-secondary)",
                      }}>
                        {message.content}
                      </div>
                    )}
                  </div>
                )}
                {message.type === "system" && (
                  <div style={{
                    textAlign: "center",
                    fontSize: "0.8rem",
                    color: "var(--app-text-color-secondary)",
                    padding: "var(--spacing-2)",
                  }}>
                    {message.content}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "var(--spacing-3) var(--spacing-4)",
          borderTop: "1px solid var(--app-border-color)",
          backgroundColor: "var(--app-header-bg)",
        }}>
          <div style={{
            display: "flex",
            gap: "var(--spacing-2)",
            marginBottom: "var(--spacing-2)",
          }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search Bible reference or phrase..."
              disabled={isSearching}
              style={{
                flex: 1,
                padding: "var(--spacing-3)",
                borderRadius: "8px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-input-bg-color)",
                color: "var(--app-input-text-color)",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={() => handleSearch(inputValue)}
              disabled={!inputValue.trim() || isSearching}
              className="primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--spacing-3) var(--spacing-4)",
              }}
            >
              <FaPaperPlane />
            </button>
          </div>
          {/* AI Search Toggle */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.85rem",
              cursor: "pointer",
              color: isAISearchEnabled ? "var(--app-primary-color)" : "var(--app-text-color-secondary)",
            }}>
              <input
                type="checkbox"
                checked={isAISearchEnabled}
                onChange={(e) => setIsAISearchEnabled(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <FaRobot size={12} />
              AI Search
            </label>
            {(() => {
              if (!isAISearchEnabled) {
                return (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--app-text-color-secondary)",
                  }}>
                    Using text search
                  </span>
                );
              }
              
              // Check if AI is configured
              const provider = settings.bibleSearchProvider || appSettings.defaultAIProvider;
              let hasApiKey = false;
              if (provider === 'openai') hasApiKey = !!appSettings.openAIConfig?.apiKey;
              else if (provider === 'gemini') hasApiKey = !!appSettings.geminiConfig?.apiKey;
              else if (provider === 'groq') hasApiKey = !!appSettings.groqConfig?.apiKey;
              
              if (provider && hasApiKey) {
                return (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--success)",
                  }}>
                    ✓ {provider} {settings.bibleSearchModel ? `(${settings.bibleSearchModel.split('/').pop()})` : ''}
                  </span>
                );
              } else if (provider && !hasApiKey) {
                return (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--warning)",
                  }}>
                    ⚠ {provider} API key missing - Settings → AI Config
                  </span>
                );
              } else {
                return (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--warning)",
                  }}>
                    ⚠ Select provider in Settings → SmartVasis
                  </span>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Live Transcription */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--app-bg-color)",
        borderRadius: "12px",
        border: "1px solid var(--app-border-color)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "var(--spacing-3) var(--spacing-4)",
          borderBottom: "1px solid var(--app-border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--app-header-bg)",
        }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
            <FaMicrophone />
            Live Transcription
            {transcriptionStatus === "recording" && (
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "rgb(239, 68, 68)",
                animation: "pulse 1s infinite",
              }} />
            )}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
            {transcriptionStatus === "idle" ? (
              <button
                onClick={handleStartTranscription}
                className="primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaMicrophone />
                Start
              </button>
            ) : transcriptionStatus === "connecting" ? (
              <button disabled className="secondary">
                Connecting...
              </button>
            ) : (
              <button
                onClick={handleStopTranscription}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "rgb(220, 38, 38)",
                  color: "white",
                  border: "none",
                  padding: "var(--spacing-2) var(--spacing-3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <FaStop />
                Stop
              </button>
            )}
            <button
              onClick={handleClearTranscript}
              className="icon-button"
              title="Clear transcript"
              style={{ padding: "6px" }}
            >
              <FaTrash size={12} />
            </button>
          </div>
        </div>

        {/* Transcript Display */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-4)",
        }}>
          {transcriptHistory.length === 0 && !interimTranscript ? (
            <div style={{
              textAlign: "center",
              color: "var(--app-text-color-secondary)",
              padding: "var(--spacing-8)",
            }}>
              <FaMicrophone size={32} style={{ marginBottom: "var(--spacing-3)", opacity: 0.5 }} />
              <p>Live transcription</p>
              <p style={{ fontSize: "0.85rem" }}>
                Click Start to begin transcribing. Bible references will be detected automatically.
              </p>
            </div>
          ) : (
            <div>
              {/* Final transcripts */}
              {transcriptHistory.map((segment) => {
                // Check if this segment contains any detected references
                const segmentRefs = detectedReferences.filter(
                  ref => ref.transcriptText === segment.text
                );
                
                return (
                  <div key={segment.id} style={{ marginBottom: "var(--spacing-3)" }}>
                    <p style={{
                      margin: 0,
                      lineHeight: 1.6,
                      color: "var(--app-text-color)",
                    }}>
                      {segment.text}
                    </p>
                    {segmentRefs.length > 0 && (
                      <div style={{ marginTop: "var(--spacing-2)" }}>
                        {segmentRefs.map(ref => renderVerseCard(ref))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Interim transcript */}
              {interimTranscript && (
                <p style={{
                  margin: 0,
                  lineHeight: 1.6,
                  color: "var(--app-text-color-secondary)",
                  fontStyle: "italic",
                }}>
                  {interimTranscript}
                </p>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Detected References Panel */}
        {detectedReferences.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--app-border-color)",
            maxHeight: "300px",
            overflowY: "auto",
          }}>
            <div style={{
              padding: "var(--spacing-2) var(--spacing-4)",
              backgroundColor: "var(--app-header-bg)",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-2)",
            }}>
              <FaChevronDown size={12} />
              Detected References ({detectedReferences.length})
            </div>
            <div style={{ padding: "var(--spacing-3) var(--spacing-4)" }}>
              {detectedReferences.slice(-5).reverse().map((ref) => renderVerseCard(ref))}
            </div>
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default SmartVasisPage;
