import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import PlaylistPane from "../components/PlaylistPane";
import SlideDisplayArea from "../components/SlideDisplayArea";
import ImportModal from "../components/ImportModal";
import ImportFromLiveSlidesModal from "../components/ImportFromLiveSlidesModal";
import ImportFromNetworkModal from "../components/ImportFromNetworkModal";
import RenameModal from "../components/RenameModal";
import ConfirmDialog from "../components/ConfirmDialog";
import TypingUrlModal from "../components/TypingUrlModal";
import ActivatePresentationModal from "../components/ActivatePresentationModal";
import { Playlist, PlaylistItem, Slide, Template, LayoutType } from "../types"; // Using types defined earlier
import {
  FaFileImport,
  FaEdit,
  FaTrash,
  FaCopy,
  FaDesktop,
  FaLink,
  FaCaretDown,
  FaCloud,
  FaFile,
} from "react-icons/fa";
import "../App.css"; // Ensure global styles are applied
import { invoke } from "@tauri-apps/api/core"; // Tauri v2 core invoke
import { formatSlidesForClipboard } from "../utils/slideUtils"; // Added import
import {
  createLiveSlideSession,
  getLiveSlidesServerInfo,
  LiveSlidesWebSocket,
  loadLiveSlidesSettings,
  startLiveSlidesServer,
  generateShareableNotepadUrl,
  generateWebSocketUrl,
} from "../services/liveSlideService";
import { LiveSlide, LiveSlidesProPresenterActivationRule } from "../types/liveSlides";
import { calculateSlideBoundaries } from "../utils/liveSlideParser";
import { triggerPresentationOnConnections } from "../services/propresenterService";
import { useNetworkSync } from "../hooks/useNetworkSync";
import { loadNetworkSyncSettings } from "../services/networkSyncService";
import { useStageAssist } from "../contexts/StageAssistContext";
import AIAutomationDropdown from "../components/AIAutomationDropdown";

const MainApplicationPage: React.FC = () => {
  // Access schedule from StageAssist context for auto-timer assignment
  const { schedule } = useStageAssist();

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem("proassist-playlists");
      return saved ? (JSON.parse(saved) as Playlist[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    () => {
      try {
        const saved = localStorage.getItem("proassist-selected-playlist-id");
        return saved || null;
      } catch {
        return null;
      }
    }
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem("proassist-selected-item-id");
      return saved || null;
    } catch {
      return null;
    }
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportFromNetworkOpen, setIsImportFromNetworkOpen] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const importDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isLiveSlidesImportOpen, setIsLiveSlidesImportOpen] = useState(false);
  const [isActivatePresentationModalOpen, setIsActivatePresentationModalOpen] =
    useState(false);
  const [copyStatusMain, setCopyStatusMain] = useState<string>(""); // Added state for feedback
  const [proofreadCorrectedSlideIds, setProofreadCorrectedSlideIds] = useState<
    string[]
  >([]); // Track slides corrected by AI proofreading
  const [typingUrlModal, setTypingUrlModal] = useState<{ url: string } | null>(
    null
  );
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInitialName, setRenameInitialName] = useState("");
  const [renameTarget, setRenameTarget] = useState<
    | { type: "playlist"; id: string }
    | { type: "item"; playlistId: string; id: string }
    | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "playlist"; id: string; name: string }
    | { type: "item"; playlistId: string; id: string; name: string }
    | null
  >(null);
  // Load templates from localStorage and keep them in sync
  const [templates, setTemplates] = useState<Template[]>(() => {
    try {
      const savedTemplates = localStorage.getItem("proassist-templates");
      return savedTemplates ? JSON.parse(savedTemplates) : [];
    } catch (error) {
      console.error("Failed to parse templates from localStorage:", error);
      return [];
    }
  });

  // Function to reload templates from localStorage
  const reloadTemplates = useCallback(() => {
    try {
      const savedTemplates = localStorage.getItem("proassist-templates");
      if (savedTemplates) {
        const parsed = JSON.parse(savedTemplates);
        setTemplates(parsed);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }, []);

  // Reload templates when import modal opens (to catch newly added templates)
  useEffect(() => {
    if (isImportModalOpen) {
      reloadTemplates();
    }
  }, [isImportModalOpen, reloadTemplates]);

  // Also listen for storage events (when localStorage changes in another tab/window)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "proassist-templates") {
        reloadTemplates();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [reloadTemplates]);

  // Reload templates when the page becomes visible (e.g., navigating back from Settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadTemplates();
      }
    };

    // Also reload on focus (covers more cases like switching tabs)
    const handleFocus = () => {
      reloadTemplates();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reloadTemplates]);

  // Listen for custom template-updated event (emitted when Settings page saves)
  useEffect(() => {
    const handleTemplatesUpdated = () => {
      reloadTemplates();
    };

    window.addEventListener("templates-updated", handleTemplatesUpdated);
    return () => {
      window.removeEventListener("templates-updated", handleTemplatesUpdated);
    };
  }, [reloadTemplates]);

  // Listen for AI-created slides event (from Global AI Chat Assistant)
  useEffect(() => {
    const handleAISlidesCreated = (event: CustomEvent<{ slides: Slide[]; templateId: string }>) => {
      const { slides, templateId } = event.detail;
      
      if (!selectedPlaylistId) {
        // If no playlist selected, create a new one
        const newPlaylistId = `playlist-${Date.now()}`;
        const newPlaylist: Playlist = {
          id: newPlaylistId,
          name: "AI Generated",
          items: [],
        };
        setPlaylists(prev => [...prev, newPlaylist]);
        setSelectedPlaylistId(newPlaylistId);
        // Continue with the newly created playlist
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("ai-slides-created", { detail: { slides, templateId } }));
        }, 100);
        return;
      }

      // Find the template
      const template = templates.find(t => t.id === templateId);
      const templateName = template?.name || "AI Generated";
      const templateColor = template?.color || "#3b82f6";

      // Create a new playlist item with the slides
      const newPlaylistItem: PlaylistItem = {
        id: `item-${Date.now()}`,
        title: slides[0]?.text?.split("\n")[0]?.substring(0, 50) || "AI Slides",
        slides: slides,
        templateName: templateName,
        templateColor: templateColor,
        defaultProPresenterActivation: template?.proPresenterActivation,
      };

      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((p) => {
          if (p.id === selectedPlaylistId) {
            return { ...p, items: [...p.items, newPlaylistItem] };
          }
          return p;
        })
      );
      setSelectedItemId(newPlaylistItem.id);
      
      console.log("AI slides added to playlist:", newPlaylistItem);
    };

    window.addEventListener("ai-slides-created", handleAISlidesCreated as EventListener);
    return () => {
      window.removeEventListener("ai-slides-created", handleAISlidesCreated as EventListener);
    };
  }, [selectedPlaylistId, templates]);

  // Live Slides server info + websocket connections (for live-linked playlist items)
  const [liveSlidesServerRunning, setLiveSlidesServerRunning] =
    useState<boolean>(false);
  const [liveSlidesWsUrl, setLiveSlidesWsUrl] = useState<string | null>(null);
  const [liveSlidesServerSessionIds, setLiveSlidesServerSessionIds] = useState<
    Set<string>
  >(new Set());
  const [liveSlidesServerIp, setLiveSlidesServerIp] =
    useState<string>("localhost");
  const liveSlidesWsMapRef = useRef<Map<string, LiveSlidesWebSocket>>(
    new Map()
  );
  // When a slide is currently being output ("Live"), avoid overwriting that slide from incoming WS updates.
  const [liveSlidesLockBySession, setLiveSlidesLockBySession] = useState<
    Record<string, number | null>
  >({});
  // When a slide is being edited locally, avoid overwriting it from incoming WS updates.
  const [liveSlidesEditLockBySession, setLiveSlidesEditLockBySession] =
    useState<Record<string, number | null>>({});
  // Use refs to access current lock state without causing re-renders
  const liveSlidesLockBySessionRef = useRef<Record<string, number | null>>({});
  const liveSlidesEditLockBySessionRef = useRef<Record<string, number | null>>(
    {}
  );

  // Keep refs in sync with state
  useEffect(() => {
    liveSlidesLockBySessionRef.current = liveSlidesLockBySession;
  }, [liveSlidesLockBySession]);
  useEffect(() => {
    liveSlidesEditLockBySessionRef.current = liveSlidesEditLockBySession;
  }, [liveSlidesEditLockBySession]);
  // Latest raw_text per session (from server) so we can patch a single slide back to the notepad.
  const [liveSlidesRawTextBySession, setLiveSlidesRawTextBySession] = useState<
    Record<string, string>
  >({});
  // Track which sessions are being created
  const [creatingLiveSlidesSessions, setCreatingLiveSlidesSessions] = useState<
    Set<string>
  >(new Set());
  // Store typing URLs for each session
  const [liveSlidesTypingUrls, setLiveSlidesTypingUrls] = useState<
    Record<string, string>
  >({});

  // Network Sync - handle receiving synced playlist items
  const handleSyncPlaylistItem = useCallback(
    (playlistId: string, item: PlaylistItem, action: "create" | "update") => {
      // Don't sync live slides items
      if (item.liveSlidesSessionId) return;

      setPlaylists((prev) => {
        return prev.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;

          if (action === "create") {
            // Check if item already exists
            const exists = playlist.items.some((i) => i.id === item.id);
            if (exists) return playlist;
            return { ...playlist, items: [...playlist.items, item] };
          } else {
            // Update existing item
            return {
              ...playlist,
              items: playlist.items.map((i) => (i.id === item.id ? item : i)),
            };
          }
        });
      });
      console.log(
        `[NetworkSync] Received ${action} for playlist item:`,
        item.title
      );
    },
    []
  );

  const handleSyncPlaylistDelete = useCallback(
    (playlistId: string, itemId: string) => {
      setPlaylists((prev) => {
        return prev.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;
          return {
            ...playlist,
            items: playlist.items.filter((i) => i.id !== itemId),
          };
        });
      });
      console.log(`[NetworkSync] Deleted playlist item: ${itemId}`);
    },
    []
  );

  const handleSyncFullState = useCallback(
    (
      syncedPlaylists: Playlist[] | undefined,
      _schedule: unknown,
      _currentSessionIndex: unknown
    ) => {
      if (syncedPlaylists) {
        // Merge synced playlists with existing ones
        setPlaylists((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPlaylists = syncedPlaylists.filter(
            (p) => !existingIds.has(p.id)
          );

          // Update existing playlists with synced items
          const merged = prev.map((existing) => {
            const synced = syncedPlaylists.find((p) => p.id === existing.id);
            if (!synced) return existing;

            // Merge items
            const existingItemIds = new Set(existing.items.map((i) => i.id));
            const newItems = synced.items.filter(
              (i) => !existingItemIds.has(i.id) && !i.liveSlidesSessionId
            );

            return {
              ...existing,
              items: [...existing.items, ...newItems],
            };
          });

          return [...merged, ...newPlaylists];
        });
        console.log("[NetworkSync] Merged full state from master/peer");
      }
    },
    []
  );

  const { broadcastPlaylistItem, broadcastPlaylistDelete } = useNetworkSync({
    onPlaylistItemSync: handleSyncPlaylistItem,
    onPlaylistItemDelete: handleSyncPlaylistDelete,
    onFullStateSync: handleSyncFullState,
  });

  // Persist playlists to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("proassist-playlists", JSON.stringify(playlists));
    } catch (err) {
      console.error("Failed to save playlists:", err);
    }
  }, [playlists]);

  // Persist selected playlist and item IDs to localStorage
  useEffect(() => {
    try {
      if (selectedPlaylistId) {
        localStorage.setItem(
          "proassist-selected-playlist-id",
          selectedPlaylistId
        );
      } else {
        localStorage.removeItem("proassist-selected-playlist-id");
      }
    } catch (err) {
      console.error("Failed to save selected playlist ID:", err);
    }
  }, [selectedPlaylistId]);

  useEffect(() => {
    try {
      if (selectedItemId) {
        localStorage.setItem("proassist-selected-item-id", selectedItemId);
      } else {
        localStorage.removeItem("proassist-selected-item-id");
      }
    } catch (err) {
      console.error("Failed to save selected item ID:", err);
    }
    // Clear proofread indicators when switching items
    setProofreadCorrectedSlideIds([]);
  }, [selectedItemId]);

  // Best-effort: keep track of the Live Slides server URL for viewer connections.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const info = await getLiveSlidesServerInfo();
        if (cancelled) return;
        setLiveSlidesServerRunning(!!info.server_running);
        setLiveSlidesWsUrl(
          info.server_running
            ? generateWebSocketUrl(info.local_ip, info.server_port)
            : null
        );
        setLiveSlidesServerSessionIds(
          new Set(Object.keys(info.sessions || {}))
        );
        setLiveSlidesServerIp(info.local_ip || "localhost");
      } catch {
        if (cancelled) return;
        setLiveSlidesServerRunning(false);
        setLiveSlidesWsUrl(null);
        setLiveSlidesServerSessionIds(new Set());
        setLiveSlidesServerIp("localhost");
      }
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setSelectedItemId(null);
  };

  const handleSelectPlaylistItem = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleOpenRenameSelectedPlaylist = () => {
    if (!currentPlaylist) return;
    setRenameTarget({ type: "playlist", id: currentPlaylist.id });
    setRenameInitialName(currentPlaylist.name);
    setIsRenameOpen(true);
  };

  const handleOpenRenameSelectedItem = () => {
    if (!currentPlaylist || !currentPlaylistItem) return;
    setRenameTarget({
      type: "item",
      playlistId: currentPlaylist.id,
      id: currentPlaylistItem.id,
    });
    setRenameInitialName(currentPlaylistItem.title);
    setIsRenameOpen(true);
  };

  const handleRename = (newName: string) => {
    if (!renameTarget) return;
    if (renameTarget.type === "playlist") {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === renameTarget.id ? { ...p, name: newName } : p
        )
      );
    } else if (renameTarget.type === "item") {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== renameTarget.playlistId) return p;
          return {
            ...p,
            items: p.items.map((it) =>
              it.id === renameTarget.id ? { ...it, title: newName } : it
            ),
          };
        })
      );
    }
    setIsRenameOpen(false);
    setRenameTarget(null);
  };

  const handleDeleteSelectedPlaylist = () => {
    if (!currentPlaylist) return;
    setPendingDelete({
      type: "playlist",
      id: currentPlaylist.id,
      name: currentPlaylist.name,
    });
  };

  const handleDeleteSelectedItem = () => {
    if (!currentPlaylist || !currentPlaylistItem) return;
    setPendingDelete({
      type: "item",
      playlistId: currentPlaylist.id,
      id: currentPlaylistItem.id,
      name: currentPlaylistItem.title,
    });
  };

  const performPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "playlist") {
      const id = pendingDelete.id;
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      const remaining = playlists.filter((p) => p.id !== id);
      setSelectedPlaylistId(remaining.length ? remaining[0].id : null);
      setSelectedItemId(null);
    } else if (pendingDelete.type === "item") {
      // Check if it's a live slides item before deleting
      const playlist = playlists.find((p) => p.id === pendingDelete.playlistId);
      const deletedItem = playlist?.items.find(
        (it) => it.id === pendingDelete.id
      );
      const isLiveSlidesItem = deletedItem?.liveSlidesSessionId;

      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== pendingDelete.playlistId) return p;
          return {
            ...p,
            items: p.items.filter((it) => it.id !== pendingDelete.id),
          };
        })
      );
      setSelectedItemId(null);

      // Broadcast delete to network sync (if enabled and not a live slides item)
      if (!isLiveSlidesItem) {
        const syncSettings = loadNetworkSyncSettings();
        if (
          syncSettings.syncPlaylists &&
          syncSettings.mode !== "off" &&
          syncSettings.mode !== "slave"
        ) {
          broadcastPlaylistDelete(pendingDelete.playlistId, pendingDelete.id);
        }
      }
    }
    setPendingDelete(null);
  };

  const currentPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const currentPlaylistItem = currentPlaylist?.items.find(
    (item) => item.id === selectedItemId
  );

  // Emit current slides changes to App.tsx for Global AI Assistant
  useEffect(() => {
    const slides = currentPlaylistItem?.slides || [];
    window.dispatchEvent(
      new CustomEvent("current-slides-changed", {
        detail: { slides },
      })
    );
  }, [currentPlaylistItem?.slides]);

  // Listen for AI-updated current slides event (from Global AI Chat Assistant)
  useEffect(() => {
    const handleAICurrentSlidesUpdated = (event: CustomEvent<{ slides: Slide[] }>) => {
      if (!selectedPlaylistId || !currentPlaylistItem) {
        console.warn("Cannot update slides: no playlist item selected");
        return;
      }

      const { slides: updatedSlides } = event.detail;

      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((p) => {
          if (p.id === selectedPlaylistId) {
            return {
              ...p,
              items: p.items.map((item) => {
                if (item.id === currentPlaylistItem.id) {
                  // Merge updated slides with existing slides (to preserve extra properties)
                  const mergedSlides = updatedSlides.map((updatedSlide) => {
                    const existingSlide = item.slides.find(s => s.id === updatedSlide.id);
                    if (existingSlide) {
                      // Preserve existing properties (like proPresenterActivation, timerSessionIndex, isAutoScripture)
                      return {
                        ...existingSlide,
                        text: updatedSlide.text,
                        layout: updatedSlide.layout,
                        order: updatedSlide.order,
                      };
                    }
                    // New slide from AI
                    return updatedSlide;
                  });
                  return {
                    ...item,
                    slides: mergedSlides,
                  };
                }
                return item;
              }),
            };
          }
          return p;
        })
      );

      console.log("AI updated current slides:", updatedSlides.length);
    };

    window.addEventListener("ai-current-slides-updated", handleAICurrentSlidesUpdated as EventListener);
    return () => {
      window.removeEventListener("ai-current-slides-updated", handleAICurrentSlidesUpdated as EventListener);
    };
  }, [selectedPlaylistId, currentPlaylistItem]);

  // Function to add a new playlist (basic example)
  const handleAddPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      items: [],
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
    setSelectedPlaylistId(newPlaylist.id); // Select the new playlist
  };

  // Function to update a slide (placeholder)
  const handleUpdateSlide = (
    playlistId: string,
    itemId: string,
    slideId: string,
    newText: string
  ) => {
    let updatedItem: PlaylistItem | undefined;

    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((playlist) => {
        if (playlist.id === playlistId) {
          return {
            ...playlist,
            items: playlist.items.map((item) => {
              if (item.id === itemId) {
                const updated = {
                  ...item,
                  slides: item.slides.map((slide) =>
                    slide.id === slideId ? { ...slide, text: newText } : slide
                  ),
                };
                updatedItem = updated;
                return updated;
              }
              return item;
            }),
          };
        }
        return playlist;
      })
    );
    console.log(
      `Update slide: ${slideId} in item ${itemId} of playlist ${playlistId} with text: ${newText}`
    );

    // Broadcast update to network sync (if enabled and not a live slides item)
    if (updatedItem && !updatedItem.liveSlidesSessionId) {
      const syncSettings = loadNetworkSyncSettings();
      if (
        syncSettings.syncPlaylists &&
        syncSettings.mode !== "off" &&
        syncSettings.mode !== "slave"
      ) {
        broadcastPlaylistItem(playlistId, updatedItem, "update");
      }
    }
  };

  // Function to make a slide live
  const handleMakeSlideLive = async (
    slide: Slide,
    playlistItem: PlaylistItem | undefined
  ) => {
    if (!playlistItem) {
      console.error("Cannot make slide live: playlist item data is missing.");
      alert("Error: Could not identify the current playlist item.");
      return;
    }

    const isLiveSlidesItem = !!playlistItem.liveSlidesSessionId;

    // Find the template used by this playlistItem
    // This assumes playlistItem.templateName is reliable for lookup.
    // A more robust way would be storing templateId in PlaylistItem.
    const template = templates.find(
      (t) => t.name === playlistItem.templateName
    );

    if (!template) {
      // Live Slides items don't require a template; they use Live Slides settings for output.
      if (!isLiveSlidesItem) {
        console.error(
          `Template '${playlistItem.templateName}' not found for playlist item '${playlistItem.title}'.`
        );
        alert(`Error: Template definition not found for this item.`);
        return;
      }
    }

    // Freeze this slide from incoming notepad updates while it is live.
    if (isLiveSlidesItem) {
      setLiveSlidesLockBySession((prev) => ({
        ...prev,
        [playlistItem.liveSlidesSessionId as string]: slide.order,
      }));
    }

    const liveSlidesSettings = isLiveSlidesItem
      ? loadLiveSlidesSettings()
      : null;

    console.log("Making slide live:", slide);
    if (liveSlidesSettings) {
      console.log("Using Live Slides output settings");
      console.log(
        `Output Path: ${liveSlidesSettings.outputPath}, Prefix: ${liveSlidesSettings.outputFilePrefix}`
      );
    } else if (template) {
      console.log("Using template:", template.name);
      console.log(
        `Output Path: ${template.outputPath}, Prefix: ${template.outputFileNamePrefix}`
      );
    }

    const lines = slide.text.split("\n");
    const rawBasePath = isLiveSlidesItem
      ? liveSlidesSettings?.outputPath
      : template?.outputPath;
    const basePath = (rawBasePath || "").trim().replace(/\/?$/, "/");
    const prefix = ((isLiveSlidesItem
      ? liveSlidesSettings?.outputFilePrefix
      : template?.outputFileNamePrefix) || "").trim();

    // Check if this is an auto-scripture slide with custom mapping configured
    const isScriptureWithMapping =
      slide.isAutoScripture &&
      !!template &&
      template.scriptureReferenceFileIndex !== undefined &&
      template.scriptureTextFileIndex !== undefined;

    try {
      if (isScriptureWithMapping) {
        // For auto-scripture slides with mapping configured:
        // - Write verse text to the designated text file index
        // - Write reference to the designated reference file index
        // - Blank out ALL other files (1-6)
        const verseText = lines[0] || ""; // First line is the verse text
        const reference = lines[1] || ""; // Second line is the reference

        console.log("Auto-scripture slide with custom mapping detected");
        console.log(
          `Reference file index: ${template!.scriptureReferenceFileIndex}`
        );
        console.log(`Text file index: ${template!.scriptureTextFileIndex}`);

        // Blank out all 6 files first
        for (let i = 1; i <= 6; i++) {
          const filePath = `${basePath}${prefix}${i}.txt`;
          await invoke("write_text_to_file", { filePath, content: "" });
        }

        // Write the reference to its designated file
        const refFilePath = `${basePath}${prefix}${
          template!.scriptureReferenceFileIndex
        }.txt`;
        console.log(
          `Writing reference to: ${refFilePath}, Content: "${reference}"`
        );
        await invoke("write_text_to_file", {
          filePath: refFilePath,
          content: reference,
        });

        // Write the verse text to its designated file
        const textFilePath = `${basePath}${prefix}${
          template!.scriptureTextFileIndex
        }.txt`;
        console.log(
          `Writing verse text to: ${textFilePath}, Content: "${verseText}"`
        );
        await invoke("write_text_to_file", {
          filePath: textFilePath,
          content: verseText,
        });
      } else {
        // Standard slide handling (non-scripture or no custom mapping)
        // Determine how many lines to write based on slide.layout
        let linesToWrite = 0;
        switch (slide.layout) {
          case "one-line":
            linesToWrite = 1;
            break;
          case "two-line":
            linesToWrite = 2;
            break;
          case "three-line":
            linesToWrite = 3;
            break;
          case "four-line":
            linesToWrite = 4;
            break;
          case "five-line":
            linesToWrite = 5;
            break;
          case "six-line":
            linesToWrite = 6;
            break;
          default:
            linesToWrite = lines.length; // Fallback: write all lines from text
        }

        for (let i = 0; i < linesToWrite; i++) {
          const lineContent = lines[i] || ""; // Use empty string if line doesn't exist
          const filePath = `${basePath}${prefix}${i + 1}.txt`;

          console.log(
            `Writing to file: ${filePath}, Content: "${lineContent}"`
          );
          await invoke("write_text_to_file", {
            filePath,
            content: lineContent,
          });
        }

        // After writing the slide's content, blank out any subsequent files
        // up to a max of 6, to clear any lingering text from previous slides.
        if (linesToWrite < 6) {
          for (let i = linesToWrite + 1; i <= 6; i++) {
            const filePath = `${basePath}${prefix}${i}.txt`;
            await invoke("write_text_to_file", { filePath, content: "" });
          }
        }
      }

      // Success: no UI notification required

      // Trigger ProPresenter presentation activation if configured
      const liveSlidesRule = isLiveSlidesItem
        ? pickLiveSlidesProPresenterRule(
            liveSlidesSettings?.proPresenterActivationRules,
            slide
          )
        : null;
      const liveSlidesRuleConfig =
        liveSlidesRule &&
        liveSlidesRule.presentationUuid &&
        typeof liveSlidesRule.slideIndex === "number"
          ? {
              presentationUuid: liveSlidesRule.presentationUuid,
              slideIndex: liveSlidesRule.slideIndex,
              presentationName: liveSlidesRule.presentationName,
            }
          : null;

      const activationConfig =
        slide.proPresenterActivation ||
        playlistItem.defaultProPresenterActivation ||
        liveSlidesRuleConfig ||
        liveSlidesSettings?.proPresenterActivation; // legacy fallback
      if (activationConfig) {
        try {
          // Get the template to check for specific ProPresenter connections
          const template = templates.find(
            (t) => t.name === playlistItem.templateName
          );

          // Use template's specific connection IDs if available, otherwise use all enabled
          const connectionIds = template?.proPresenterConnectionIds;
          // Use slide-level override if present, otherwise use template setting (default: 1)
          const activationClicks =
            slide.proPresenterActivation?.activationClicks ??
            playlistItem.defaultProPresenterActivation?.activationClicks ??
            liveSlidesRule?.activationClicks ??
            liveSlidesSettings?.proPresenterActivation?.activationClicks ?? // legacy fallback
            template?.proPresenterActivationClicks ??
            1;

          const result = await triggerPresentationOnConnections(
            activationConfig,
            connectionIds,
            activationClicks,
            100 // 100ms delay between clicks
          );
          if (result.success > 0) {
            console.log(
              `Presentation activated on ${result.success} ProPresenter instance(s)`
            );
          }
          if (result.failed > 0) {
            console.warn(
              `Failed to activate presentation on ${result.failed} instance(s):`,
              result.errors
            );
          }
        } catch (error) {
          console.error("Failed to trigger ProPresenter presentation:", error);
          // Don't block the "Go Live" action if presentation activation fails
        }
      }

      // Clear text files after going live if configured
      if (template?.clearTextAfterLive && basePath && prefix) {
        const clearDelay = template.clearTextDelay ?? 0;
        if (clearDelay > 0) {
          setTimeout(async () => {
            await clearTextFiles(basePath, prefix);
          }, clearDelay);
        } else {
          await clearTextFiles(basePath, prefix);
        }
      }
    } catch (error) {
      console.error("Failed to write slide content to file(s):", error);
      alert("Error making slide live. Check console for details.");
    }
    // Note: The visual feedback (setting liveSlideId in SlideDisplayArea) is handled locally in that component.
    // This function focuses on the side effect (writing to files).
  };

  // Helper function to clear all text files
  const clearTextFiles = async (basePath: string, prefix: string) => {
    try {
      for (let i = 1; i <= 6; i++) {
        const filePath = `${basePath}${prefix}${i}.txt`;
        await invoke("write_text_to_file", { filePath, content: "" });
      }
      console.log("Text files cleared after going live");
    } catch (error) {
      console.error("Failed to clear text files:", error);
    }
  };

  const getLineCountForLayout = (layout: LayoutType): number => {
    switch (layout) {
      case "one-line":
        return 1;
      case "two-line":
        return 2;
      case "three-line":
        return 3;
      case "four-line":
        return 4;
      case "five-line":
        return 5;
      case "six-line":
        return 6;
      default:
        return 1;
    }
  };

  const pickLiveSlidesProPresenterRule = (
    rules: LiveSlidesProPresenterActivationRule[] | undefined,
    slide: Slide
  ): LiveSlidesProPresenterActivationRule | null => {
    if (!rules || !rules.length) return null;
    const lineCount = getLineCountForLayout(slide.layout);
    const exact = rules.find((r) => r.lineCount === lineCount);
    if (exact) return exact;
    const fallback = rules.find((r) => r.lineCount === 0);
    return fallback || null;
  };

  // Function to handle "Take Off" action
  const handleTakeOffSlide = async (
    slide: Slide,
    playlistItem: PlaylistItem | undefined
  ) => {
    if (!playlistItem) {
      console.error("Cannot take off slide: playlist item data is missing.");
      return;
    }

    const isLiveSlidesItem = !!playlistItem.liveSlidesSessionId;
    const template = isLiveSlidesItem
      ? undefined
      : templates.find((t) => t.name === playlistItem.templateName);

    if (!template && !isLiveSlidesItem) {
      console.warn("Template not found for take off action");
      return;
    }

    const liveSlidesSettings = isLiveSlidesItem
      ? loadLiveSlidesSettings()
      : null;

    // Trigger ProPresenter presentation activation if configured
    const liveSlidesRule = isLiveSlidesItem
      ? pickLiveSlidesProPresenterRule(
          liveSlidesSettings?.proPresenterActivationRules,
          slide
        )
      : null;
    const liveSlidesRuleConfig =
      liveSlidesRule &&
      liveSlidesRule.presentationUuid &&
      typeof liveSlidesRule.slideIndex === "number"
        ? {
            presentationUuid: liveSlidesRule.presentationUuid,
            slideIndex: liveSlidesRule.slideIndex,
            presentationName: liveSlidesRule.presentationName,
          }
        : null;

    const activationConfig =
      slide.proPresenterActivation ||
      playlistItem.defaultProPresenterActivation ||
      liveSlidesRuleConfig ||
      liveSlidesSettings?.proPresenterActivation; // legacy fallback

    if (activationConfig) {
      // Use slide-level override if present, otherwise use template setting (default: 0)
      const takeOffClicks =
        slide.proPresenterActivation?.takeOffClicks ??
        playlistItem.defaultProPresenterActivation?.takeOffClicks ??
        liveSlidesRule?.takeOffClicks ??
        liveSlidesSettings?.proPresenterActivation?.takeOffClicks ?? // legacy fallback
        template?.proPresenterTakeOffClicks ??
        0;

      // If takeOffClicks is 0, don't trigger ProPresenter at all
      if (takeOffClicks === 0) {
        console.log(
          "Take off clicks set to 0 - skipping ProPresenter triggers"
        );
        return;
      }

      try {
        // Use template's specific connection IDs if available, otherwise use all enabled
        const connectionIds = template?.proPresenterConnectionIds;

        const result = await triggerPresentationOnConnections(
          activationConfig,
          connectionIds,
          takeOffClicks,
          100 // 100ms delay between clicks
        );
        if (result.success > 0) {
          console.log(
            `Take off triggered on ${result.success} ProPresenter instance(s)`
          );
        }
        if (result.failed > 0) {
          console.warn(
            `Failed to trigger take off on ${result.failed} instance(s):`,
            result.errors
          );
        }
      } catch (error) {
        console.error("Failed to trigger ProPresenter take off:", error);
      }
    }

    if (isLiveSlidesItem) {
      const shouldClear =
        (liveSlidesRule?.clearTextFileOnTakeOff ??
          liveSlidesSettings?.proPresenterActivation?.clearTextFileOnTakeOff) !==
        false;
      if (shouldClear) {
        const basePath = (liveSlidesSettings?.outputPath || "").replace(
          /\/?$/,
          "/"
        );
        const prefix = liveSlidesSettings?.outputFilePrefix || "";
        if (basePath && prefix) {
          await clearTextFiles(basePath, prefix);
        }
      }
    }
  };

  const handleAddSlide = (layout: LayoutType) => {
    if (!selectedPlaylistId || !selectedItemId) {
      alert("Please select a playlist and an item within it to add a slide.");
      return;
    }
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      text: "New Slide", // Default text
      layout: layout,
      order: (currentPlaylistItem?.slides.length || 0) + 1,
    };

    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  slides: [...item.slides, newSlide],
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
    // Optionally, you might want to auto-select the new slide for editing
    // This would require passing setEditingSlideId and setEditingLines down or a callback
  };

  const handleDeleteSlide = (slideIdToDelete: string) => {
    if (!selectedPlaylistId || !selectedItemId) {
      alert("Cannot delete slide: No playlist or item selected.");
      return;
    }
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  slides: item.slides
                    .filter((s) => s.id !== slideIdToDelete)
                    .map((s, index) => ({ ...s, order: index + 1 })), // Re-order remaining slides
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
  };

  const handleChangeSlideLayout = (
    slideIdToChange: string,
    newLayout: LayoutType
  ) => {
    if (!selectedPlaylistId || !selectedItemId) {
      alert("Cannot change slide layout: No playlist or item selected.");
      return;
    }
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  slides: item.slides.map((s) =>
                    s.id === slideIdToChange ? { ...s, layout: newLayout } : s
                  ),
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
    // After changing layout, if the user edits, SlideDisplayArea's handleEdit will pick up the new layout
    // and adjust the number of editing fields. Text truncation/addition if lines change is implicitly handled by
    // how text is split and joined during edit; more sophisticated handling could be added if needed.
  };

  const handleChangeTimerSession = (
    slideIdToChange: string,
    sessionIndex: number | undefined
  ) => {
    if (!selectedPlaylistId || !selectedItemId) {
      return;
    }
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  slides: item.slides.map((s) =>
                    s.id === slideIdToChange
                      ? { ...s, timerSessionIndex: sessionIndex }
                      : s
                  ),
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
  };

  const handleSaveDefaultActivation = (
    config:
      | {
          presentationUuid: string;
          slideIndex: number;
          presentationName?: string;
        }
      | undefined
  ) => {
    if (!selectedPlaylistId || !selectedItemId) {
      return;
    }
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  defaultProPresenterActivation: config,
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
  };

  const handleChangeProPresenterActivation = (
    slideIdToChange: string,
    config:
      | {
          presentationUuid: string;
          slideIndex: number;
          presentationName?: string;
        }
      | undefined
  ) => {
    if (!selectedPlaylistId || !selectedItemId) {
      return;
    }
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === selectedItemId) {
                return {
                  ...item,
                  slides: item.slides.map((s) =>
                    s.id === slideIdToChange
                      ? { ...s, proPresenterActivation: config }
                      : s
                  ),
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );
  };

  // Handle AI Automation slide updates (from AIAutomationDropdown)
  const handleAIAutomationSlidesUpdated = (
    updatedSlides: Slide[],
    correctedSlideIds?: string[]
  ) => {
    if (!selectedPlaylistId || !currentPlaylistItem) return;

    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.map((item) => {
              if (item.id === currentPlaylistItem.id) {
                return {
                  ...item,
                  slides: updatedSlides,
                };
              }
              return item;
            }),
          };
        }
        return p;
      })
    );

    // Set corrected slide IDs for visual indicator
    if (correctedSlideIds && correctedSlideIds.length > 0) {
      setProofreadCorrectedSlideIds(correctedSlideIds);
      // Clear the indicators after 30 seconds to not clutter the UI forever
      setTimeout(() => {
        setProofreadCorrectedSlideIds([]);
      }, 30000);
    }
  };

  const handleCopyToClipboardMain = async () => {
    if (currentPlaylistItem && currentPlaylistItem.slides.length > 0) {
      const formattedText = formatSlidesForClipboard(
        currentPlaylistItem.slides
      );
      try {
        await navigator.clipboard.writeText(formattedText);
        setCopyStatusMain("Copied!");
        setTimeout(() => setCopyStatusMain(""), 2000); // Clear feedback after 2s
      } catch (err) {
        console.error("Failed to copy slides: ", err);
        setCopyStatusMain("Failed to copy.");
        setTimeout(() => setCopyStatusMain(""), 2000);
      }
    } else {
      alert("No slides to copy.");
    }
  };

  const handleCopyLiveSlidesTypingLink = async () => {
    const sid = currentPlaylistItem?.liveSlidesSessionId;
    if (!sid) return;

    if (!liveSlidesServerRunning || !liveSlidesServerSessionIds.has(sid)) {
      alert(
        "That Live Slides session isn't running. Click Restart/Resume Session first."
      );
      return;
    }

    const settings = loadLiveSlidesSettings();
    // Use the server port (which serves both HTTP and WebSocket) instead of hardcoded dev port
    const url = generateShareableNotepadUrl(
      liveSlidesServerIp,
      settings.serverPort,
      sid
    );

    // Show typing URL modal
    setTypingUrlModal({ url });

    // Try to copy to clipboard automatically (non-blocking)
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatusMain("Link Copied!");
      setTimeout(() => setCopyStatusMain(""), 2000);
    } catch (e) {
      console.error(e);
      // Clipboard access denied - user can copy from modal
    }
  };

  const handleImportFromModal = (
    itemName: string,
    templateName: string,
    slidesFromModal: Pick<Slide, "text" | "layout" | "isAutoScripture">[],
    options?: { liveSlidesSessionId?: string; liveSlidesLinked?: boolean }
  ) => {
    if (!selectedPlaylistId) {
      alert("No playlist selected to add the imported item to.");
      return;
    }

    const isLiveSlidesItem = !!options?.liveSlidesSessionId;
    const selectedTemplate = isLiveSlidesItem
      ? undefined
      : templates.find((t) => t.name === templateName);
    if (!isLiveSlidesItem && !selectedTemplate) {
      alert(`Template "${templateName}" not found. Cannot import.`);
      setIsImportModalOpen(false);
      return;
    }
    const templateColorUsed = isLiveSlidesItem
      ? "#2563eb"
      : selectedTemplate!.color || "#808080";

    const fullSlides: Slide[] = slidesFromModal.map((slideData, index) => ({
      ...slideData,
      id: `slide-${Date.now()}-${index}`,
      order: index + 1,
    }));

    const newPlaylistItem: PlaylistItem = {
      id: `item-${Date.now()}`,
      title: itemName,
      slides: fullSlides,
      templateName: templateName,
      templateColor: templateColorUsed,
      liveSlidesSessionId: options?.liveSlidesSessionId,
      liveSlidesLinked: options?.liveSlidesSessionId
        ? options?.liveSlidesLinked ?? true
        : undefined,
      // Copy ProPresenter activation settings from template
      defaultProPresenterActivation: selectedTemplate?.proPresenterActivation,
    };

    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((p) => {
        if (p.id === selectedPlaylistId) {
          return { ...p, items: [...p.items, newPlaylistItem] };
        }
        return p;
      })
    );
    setSelectedItemId(newPlaylistItem.id);
    setIsImportModalOpen(false);

    // Broadcast new playlist item to network sync (if enabled and not a live slides item)
    if (!isLiveSlidesItem && selectedPlaylistId) {
      const syncSettings = loadNetworkSyncSettings();
      if (
        syncSettings.syncPlaylists &&
        syncSettings.mode !== "off" &&
        syncSettings.mode !== "slave"
      ) {
        broadcastPlaylistItem(selectedPlaylistId, newPlaylistItem, "create");
      }
    }
  };

  const handleDetachCurrentLiveSlides = () => {
    if (!currentPlaylist || !currentPlaylistItem) return;
    const sid = currentPlaylistItem.liveSlidesSessionId;
    if (!sid) return;

    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== currentPlaylist.id) return p;
        return {
          ...p,
          items: p.items.map((it) => {
            if (it.id !== currentPlaylistItem.id) return it;
            return {
              ...it,
              liveSlidesLinked: false,
            };
          }),
        };
      })
    );

    // Clear any "live slide" lock for this session once detached.
    setLiveSlidesLockBySession((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });

    // Clear any edit lock/raw text cache for this session once detached.
    setLiveSlidesEditLockBySession((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });
    setLiveSlidesRawTextBySession((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });
  };

  const buildRawTextFromSlides = (slides: Slide[]): string => {
    return slides
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => (s.text || "").trim())
      .filter((t) => t.length > 0)
      .join("\n\n");
  };

  const handleResumeCurrentLiveSlidesSession = async () => {
    if (!currentPlaylist || !currentPlaylistItem?.liveSlidesSessionId) return;

    const sessionId = currentPlaylistItem.liveSlidesSessionId;

    try {
      // Mark session as being created
      setCreatingLiveSlidesSessions((prev) => new Set(prev).add(sessionId));

      const settings = loadLiveSlidesSettings();

      // Ensure server is running.
      if (!liveSlidesServerRunning) {
        await startLiveSlidesServer(settings.serverPort);
      }

      // Re-fetch server info to get IP + port + sessions
      const info = await getLiveSlidesServerInfo();
      setLiveSlidesServerRunning(!!info.server_running);
      setLiveSlidesWsUrl(
        info.server_running
          ? generateWebSocketUrl(info.local_ip, info.server_port)
          : null
      );
      setLiveSlidesServerSessionIds(new Set(Object.keys(info.sessions || {})));

      if (!info.server_running) {
        alert("Failed to start Live Slides server.");
        setCreatingLiveSlidesSessions((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        return;
      }

      // Create a fresh session and seed it with our cached content.
      const session = await createLiveSlideSession(currentPlaylistItem.title);

      const seedRaw = currentPlaylistItem.liveSlidesCachedRawText?.trim().length
        ? currentPlaylistItem.liveSlidesCachedRawText
        : buildRawTextFromSlides(currentPlaylistItem.slides);

      // Update item to point at new session id (so future reconnects + WS updates work).
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== currentPlaylist.id) return p;
          return {
            ...p,
            items: p.items.map((it) => {
              if (it.id !== currentPlaylistItem.id) return it;
              return {
                ...it,
                liveSlidesSessionId: session.id,
                liveSlidesLinked: true,
                liveSlidesCachedRawText: seedRaw,
              };
            }),
          };
        })
      );

      // Seed the server via WS - ensure text is sent before notepad connects.
      const wsUrl = generateWebSocketUrl(info.local_ip, info.server_port);
      const ws = new LiveSlidesWebSocket(wsUrl, session.id, "viewer");
      liveSlidesWsMapRef.current.set(session.id, ws);
      await ws.connect();

      // Send the text update to seed the session
      if (seedRaw.trim().length > 0) {
        ws.sendTextUpdate(seedRaw);
        // Give the server a moment to process the update before showing the URL
        // This ensures the notepad will receive the pre-populated content when it connects
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Store typing URL for this session
      // Use the server port (which serves both HTTP and WebSocket) instead of hardcoded dev port
      const typingUrl = generateShareableNotepadUrl(
        info.local_ip,
        settings.serverPort,
        session.id
      );
      setLiveSlidesTypingUrls((prev) => ({
        ...prev,
        [session.id]: typingUrl,
      }));

      // Update server session IDs to include the new session
      setLiveSlidesServerSessionIds((prev) => new Set(prev).add(session.id));

      // Show typing URL modal
      setTypingUrlModal({ url: typingUrl });

      // Try to copy to clipboard automatically (non-blocking)
      try {
        await navigator.clipboard.writeText(typingUrl);
      } catch (clipboardError) {
        // Clipboard access denied - user can copy from modal
      }

      // Mark session creation as complete
      setCreatingLiveSlidesSessions((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        if (session.id !== sessionId) {
          next.delete(session.id);
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to restart Live Slides session: ${msg}`);
      setCreatingLiveSlidesSessions((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const patchSlideIntoRawText = (
    rawText: string,
    slideOrder: number,
    newSlideText: string
  ): string => {
    const safeLines = newSlideText
      .split("\n")
      // Avoid creating new slide boundaries from empty lines inside a slide.
      .map((l) => l.trimEnd())
      .filter((l) => l.trim() !== "");

    const lines = rawText.split("\n");
    const boundaries = calculateSlideBoundaries(rawText);
    const boundary = boundaries.find((b) => b.slideIndex === slideOrder - 1);
    if (!boundary) {
      // If we can't find it, fallback to appending at the end as a best-effort.
      const prefix = rawText.trim().length ? `${rawText.trimEnd()}\n\n` : "";
      return `${prefix}${safeLines.join("\n")}`;
    }

    const before = lines.slice(0, boundary.startLine);
    const after = lines.slice(boundary.endLine + 1);
    const nextLines = [...before, ...safeLines, ...after];
    return nextLines.join("\n");
  };

  const handleUpdateLiveSlidesSlide = async (
    playlistId: string,
    itemId: string,
    slideId: string,
    newText: string
  ) => {
    const pl = playlists.find((p) => p.id === playlistId);
    const it = pl?.items.find((x) => x.id === itemId);
    const sid = it?.liveSlidesSessionId;
    if (!pl || !it || !sid) return;

    const slide = it.slides.find((s) => s.id === slideId);
    if (!slide) return;

    const ws = liveSlidesWsMapRef.current.get(sid);
    if (!ws) {
      alert("Live Slides connection is not ready yet. Try again in a moment.");
      return;
    }
    if (!ws.isConnected) {
      // Best-effort: connect in the background; the WS client will queue messages until open.
      ws.connect().catch(() => {});
    }

    // Lock this slide while we patch + send.
    setLiveSlidesEditLockBySession((prev) => ({ ...prev, [sid]: slide.order }));

    const baseRaw =
      liveSlidesRawTextBySession[sid] &&
      liveSlidesRawTextBySession[sid].trim().length
        ? liveSlidesRawTextBySession[sid]
        : buildRawTextFromSlides(it.slides);

    const nextRaw = patchSlideIntoRawText(baseRaw, slide.order, newText);

    // Optimistically update local slides (WS update will reconcile).
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          items: p.items.map((x) => {
            if (x.id !== itemId) return x;
            return {
              ...x,
              slides: x.slides.map((s) =>
                s.id === slideId ? { ...s, text: newText } : s
              ),
            };
          }),
        };
      })
    );

    setLiveSlidesRawTextBySession((prev) => ({ ...prev, [sid]: nextRaw }));
    ws.sendTextUpdate(nextRaw);

    // Unlock after save; future updates can overwrite again.
    setLiveSlidesEditLockBySession((prev) => ({ ...prev, [sid]: null }));
  };

  const getLayoutName = (count: number): string => {
    const names: Record<number, string> = {
      1: "one",
      2: "two",
      3: "three",
      4: "four",
      5: "five",
      6: "six",
    };
    return names[Math.min(count, 6)] || "one";
  };

  const convertLiveSlidesToSlidesForItem = useMemo(() => {
    return (
      sessionId: string,
      _templateName: string,
      liveSlides: LiveSlide[]
    ): Slide[] => {
      return liveSlides.map((liveSlide, idx) => {
        const text = liveSlide.items.map((item) => item.text).join("\n");

        const itemCount = liveSlide.items.length;
        const candidate = `${getLayoutName(itemCount)}-line` as LayoutType;
        const layout: LayoutType = candidate;

        return {
          id: `live-${sessionId}-${idx}`,
          order: idx + 1,
          text,
          layout,
          isAutoScripture: false,
        };
      });
    };
  }, [templates]);

  // Compute all existing live slides session IDs for import modal (to avoid duplicates)
  const existingLiveSlidesSessionIds = useMemo(() => {
    const sessionIds: string[] = [];
    for (const p of playlists) {
      for (const it of p.items) {
        if (it.liveSlidesSessionId) {
          sessionIds.push(it.liveSlidesSessionId);
        }
      }
    }
    return sessionIds;
  }, [playlists]);

  // Check if we can load from master (network sync configured as slave/peer with remote host)
  const networkSyncSettingsForImport = loadNetworkSyncSettings();
  const canLoadFromMaster =
    (networkSyncSettingsForImport.mode === "slave" ||
      networkSyncSettingsForImport.mode === "peer") &&
    networkSyncSettingsForImport.remoteHost.trim() !== "";

  // Close import dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        importDropdownRef.current &&
        !importDropdownRef.current.contains(event.target as Node)
      ) {
        setShowImportDropdown(false);
      }
    };

    if (showImportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showImportDropdown]);

  // Live update any live-linked playlist items while the server is running.
  useEffect(() => {
    const linkedSessionIds = new Set<string>();
    for (const p of playlists) {
      for (const it of p.items) {
        if (it.liveSlidesSessionId && (it.liveSlidesLinked ?? true)) {
          linkedSessionIds.add(it.liveSlidesSessionId);
        }
      }
    }

    // Disconnect any sockets no longer needed.
    for (const [sid, ws] of liveSlidesWsMapRef.current.entries()) {
      if (!linkedSessionIds.has(sid) || !liveSlidesWsUrl) {
        ws.disconnect();
        liveSlidesWsMapRef.current.delete(sid);
      }
    }

    if (!liveSlidesWsUrl || !liveSlidesServerRunning) return;

    // Connect missing sockets.
    linkedSessionIds.forEach((sid) => {
      if (liveSlidesWsMapRef.current.has(sid)) return;
      const ws = new LiveSlidesWebSocket(liveSlidesWsUrl, sid, "viewer");
      liveSlidesWsMapRef.current.set(sid, ws);

      ws.connect().catch(() => {
        // Best-effort; status is surfaced via serverRunning polling + future UI
      });

      const unsub = ws.onSlidesUpdate((update) => {
        if (update.session_id !== sid) return;
        setPlaylists((prev) =>
          prev.map((pl) => ({
            ...pl,
            items: pl.items.map((it) => {
              if (
                it.liveSlidesSessionId !== sid ||
                !(it.liveSlidesLinked ?? true)
              )
                return it;
              let nextSlides = convertLiveSlidesToSlidesForItem(
                sid,
                it.templateName,
                update.slides as unknown as LiveSlide[]
              );
              // Use refs to get current lock state without causing re-renders
              const lockOrders = [
                liveSlidesLockBySessionRef.current[sid],
                liveSlidesEditLockBySessionRef.current[sid],
              ].filter((x): x is number => typeof x === "number");
              if (lockOrders.length) {
                for (const lo of lockOrders) {
                  const lockedExisting = it.slides.find((s) => s.order === lo);
                  if (lockedExisting) {
                    nextSlides = nextSlides.map((s) =>
                      s.order === lo ? { ...lockedExisting } : s
                    );
                  }
                }
              }
              const nextCached = buildRawTextFromSlides(nextSlides);
              setLiveSlidesRawTextBySession((prevRaw) => ({
                ...prevRaw,
                [sid]: update.raw_text || nextCached,
              }));
              return {
                ...it,
                slides: nextSlides,
                liveSlidesCachedRawText: nextCached,
              };
            }),
          }))
        );
      });

      // Store unsubscribe by wrapping disconnect (simple; if we later need, refactor).
      const originalDisconnect = ws.disconnect.bind(ws);
      ws.disconnect = () => {
        unsub();
        originalDisconnect();
      };
    });
  }, [
    playlists,
    liveSlidesWsUrl,
    liveSlidesServerRunning,
    convertLiveSlidesToSlidesForItem,
    // Note: liveSlidesLockBySession and liveSlidesEditLockBySession are NOT in deps
    // to avoid reconnecting WebSockets when locks change. We use refs to access current values.
  ]);

  // Style objects using CSS variables. These could also be classes in App.css
  const pageLayoutStyle: React.CSSProperties = {
    display: "flex",
    // The nav bar in App.tsx is assumed to be around 50px.
    // If its height changes, this calculation needs to adapt.
    // Consider using flexbox for the main App layout to avoid magic numbers.
    height: "calc(100vh - 51px)", // Assuming nav is 50px + 1px border
    backgroundColor: "var(--app-bg-color)",
  };

  const leftColumnStyle: React.CSSProperties = {
    width: "300px",
    flexShrink: 0, // Add this line
    borderRight: "1px solid var(--app-border-color)",
    overflowY: "auto",
    padding: "var(--spacing-3)",
    backgroundColor: "#1e1e1e",
  };

  const rightColumnStyle: React.CSSProperties = {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    backgroundColor: "var(--app-bg-color)",
  };

  const rightColumnHeaderStyle: React.CSSProperties = {
    padding: "var(--spacing-3) var(--spacing-4)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
  };

  return (
    <div style={pageLayoutStyle}>
      <div style={leftColumnStyle}>
        <PlaylistPane
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={handleSelectPlaylist}
          onAddPlaylist={handleAddPlaylist}
          selectedItemId={selectedItemId}
          onSelectPlaylistItem={handleSelectPlaylistItem}
        />
      </div>
      <div style={rightColumnStyle}>
        <div style={rightColumnHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontWeight: 500 }}>
              {currentPlaylist
                ? `${
                    currentPlaylistItem
                      ? currentPlaylistItem.title
                      : currentPlaylist.name
                  }`
                : "Select a Playlist"}
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Import Dropdown */}
            <div ref={importDropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => {
                  if (currentPlaylist) {
                    setShowImportDropdown(!showImportDropdown);
                  } else {
                    alert("Please select a playlist first.");
                  }
                }}
                disabled={!currentPlaylist}
                className="primary"
                title={`Import to "${currentPlaylist?.name || "Playlist"}"`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaFileImport />
                Import
                <FaCaretDown style={{ marginLeft: "4px" }} />
              </button>

              {showImportDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "4px",
                    backgroundColor: "var(--app-bg-color)",
                    border: "1px solid var(--app-border-color)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    zIndex: 100,
                    minWidth: "200px",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowImportDropdown(false);
                      setIsImportModalOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "10px 14px",
                      backgroundColor: "transparent",
                      color: "var(--app-text-color)",
                      border: "none",
                      borderBottom: "1px solid var(--app-border-color)",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--app-hover-bg-color)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FaFile style={{ opacity: 0.7 }} /> From Text
                  </button>
                  <button
                    onClick={() => {
                      setShowImportDropdown(false);
                      setIsImportFromNetworkOpen(true);
                    }}
                    disabled={!canLoadFromMaster}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "10px 14px",
                      backgroundColor: "transparent",
                      color: canLoadFromMaster
                        ? "var(--app-text-color)"
                        : "var(--app-text-color-secondary)",
                      border: "none",
                      cursor: canLoadFromMaster ? "pointer" : "not-allowed",
                      fontSize: "0.875rem",
                      textAlign: "left",
                      opacity: canLoadFromMaster ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (canLoadFromMaster) {
                        e.currentTarget.style.backgroundColor =
                          "var(--app-hover-bg-color)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    title={
                      !canLoadFromMaster
                        ? "Configure network sync as slave/peer with a remote host in Settings → Network"
                        : ""
                    }
                  >
                    <FaCloud style={{ opacity: 0.7 }} />
                    From Network
                    {!canLoadFromMaster && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          marginLeft: "auto",
                          color: "var(--app-text-color-secondary)",
                        }}
                      >
                        (Not configured)
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (currentPlaylist) {
                  setIsLiveSlidesImportOpen(true);
                } else {
                  alert("Please select a playlist first.");
                }
              }}
              disabled={!currentPlaylist}
              className="secondary"
              title="Import from Live Slides session"
            >
              <FaDesktop />
              Live Slides
            </button>
            <button
              onClick={() => {
                if (currentPlaylist && currentPlaylistItem) {
                  setIsActivatePresentationModalOpen(true);
                } else {
                  alert("Please select a playlist item first.");
                }
              }}
              disabled={!currentPlaylist || !currentPlaylistItem}
              className="secondary"
              title="Activate presentation on ProPresenter when slides go live"
              style={{ padding: "8px 10px" }}
            >
              <FaDesktop />
            </button>
            <AIAutomationDropdown
              slides={currentPlaylistItem?.slides || []}
              schedule={schedule}
              onSlidesUpdated={handleAIAutomationSlidesUpdated}
              disabled={!currentPlaylist || !currentPlaylistItem}
            />
            {currentPlaylistItem && currentPlaylistItem.slides.length > 0 && (
              <button
                onClick={handleCopyToClipboardMain}
                title="Copy all slides in this item to clipboard"
                className="secondary"
              >
                <FaCopy />
              </button>
            )}
            {currentPlaylist && !currentPlaylistItem && (
              <button
                onClick={handleOpenRenameSelectedPlaylist}
                className="secondary btn-sm"
                title="Rename playlist"
              >
                <FaEdit />
              </button>
            )}
            {currentPlaylist && currentPlaylistItem && (
              <button
                onClick={handleOpenRenameSelectedItem}
                className="secondary btn-sm"
                title="Rename item"
              >
                <FaEdit />
              </button>
            )}
            {currentPlaylist && !currentPlaylistItem && (
              <button
                onClick={handleDeleteSelectedPlaylist}
                className="secondary btn-sm"
                title="Delete playlist"
              >
                <FaTrash />
              </button>
            )}
            {currentPlaylist && currentPlaylistItem && (
              <button
                onClick={handleDeleteSelectedItem}
                className="secondary btn-sm"
                title="Delete item"
              >
                <FaTrash />
              </button>
            )}
            {currentPlaylistItem?.liveSlidesSessionId &&
              (currentPlaylistItem.liveSlidesLinked ?? true) && (
                <button
                  onClick={handleCopyLiveSlidesTypingLink}
                  title="Copy the typing link for this Live Slides session"
                  className="secondary"
                >
                  <FaLink />
                </button>
              )}
            {copyStatusMain && (
              <span
                style={{
                  marginLeft: "5px",
                  fontSize: "0.8em",
                  color: "var(--accent)",
                }}
              >
                {copyStatusMain}
              </span>
            )}
          </div>
        </div>
        <div
          className="slide-display-scroll-container"
          style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}
        >
          <SlideDisplayArea
            playlistItem={currentPlaylistItem}
            template={templates.find(
              (t) => t.name === currentPlaylistItem?.templateName
            )}
            liveSlidesStatus={
              currentPlaylistItem?.liveSlidesSessionId &&
              (currentPlaylistItem.liveSlidesLinked ?? true)
                ? {
                    serverRunning: liveSlidesServerRunning,
                    sessionExists: liveSlidesServerSessionIds.has(
                      currentPlaylistItem.liveSlidesSessionId
                    ),
                    isCreating: creatingLiveSlidesSessions.has(
                      currentPlaylistItem.liveSlidesSessionId
                    ),
                    typingUrl:
                      liveSlidesTypingUrls[
                        currentPlaylistItem.liveSlidesSessionId
                      ],
                  }
                : undefined
            }
            onResumeLiveSlidesSession={
              currentPlaylistItem?.liveSlidesSessionId &&
              (currentPlaylistItem.liveSlidesLinked ?? true) &&
              (!liveSlidesServerRunning ||
                !liveSlidesServerSessionIds.has(
                  currentPlaylistItem.liveSlidesSessionId
                ))
                ? handleResumeCurrentLiveSlidesSession
                : undefined
            }
            onDetachLiveSlides={
              currentPlaylistItem?.liveSlidesSessionId &&
              (currentPlaylistItem.liveSlidesLinked ?? true)
                ? handleDetachCurrentLiveSlides
                : undefined
            }
            onBeginLiveSlideEdit={(slide) => {
              const sid = currentPlaylistItem?.liveSlidesSessionId;
              if (!sid) return;
              if (!(currentPlaylistItem?.liveSlidesLinked ?? true)) return;
              setLiveSlidesEditLockBySession((prev) => ({
                ...prev,
                [sid]: slide.order,
              }));
            }}
            onEndLiveSlideEdit={() => {
              const sid = currentPlaylistItem?.liveSlidesSessionId;
              if (!sid) return;
              setLiveSlidesEditLockBySession((prev) => ({
                ...prev,
                [sid]: null,
              }));
            }}
            onUpdateSlide={(slideId, newText) => {
              if (currentPlaylist && currentPlaylistItem) {
                if (
                  currentPlaylistItem.liveSlidesSessionId &&
                  (currentPlaylistItem.liveSlidesLinked ?? true)
                ) {
                  handleUpdateLiveSlidesSlide(
                    currentPlaylist.id,
                    currentPlaylistItem.id,
                    slideId,
                    newText
                  );
                } else {
                  handleUpdateSlide(
                    currentPlaylist.id,
                    currentPlaylistItem.id,
                    slideId,
                    newText
                  );
                }
              }
            }}
            onMakeSlideLive={(slide) =>
              handleMakeSlideLive(slide, currentPlaylistItem)
            }
            onTakeOffSlide={(slide) =>
              handleTakeOffSlide(slide, currentPlaylistItem)
            }
            onAddSlide={handleAddSlide}
            onDeleteSlide={handleDeleteSlide}
            onChangeSlideLayout={handleChangeSlideLayout}
            onChangeTimerSession={handleChangeTimerSession}
            onChangeProPresenterActivation={handleChangeProPresenterActivation}
            proofreadCorrectedSlideIds={proofreadCorrectedSlideIds}
          />
        </div>
      </div>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templates={templates}
        onImport={handleImportFromModal}
      />
      <ImportFromNetworkModal
        isOpen={isImportFromNetworkOpen}
        onClose={() => setIsImportFromNetworkOpen(false)}
        onImport={handleImportFromModal}
        existingSessionIds={existingLiveSlidesSessionIds}
      />
      <ImportFromLiveSlidesModal
        isOpen={isLiveSlidesImportOpen}
        onClose={() => setIsLiveSlidesImportOpen(false)}
        templates={templates}
        onImport={handleImportFromModal}
      />
      <ActivatePresentationModal
        isOpen={isActivatePresentationModalOpen}
        onClose={() => setIsActivatePresentationModalOpen(false)}
        onSave={handleSaveDefaultActivation}
        currentConfig={currentPlaylistItem?.defaultProPresenterActivation}
      />
      <RenameModal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onRename={handleRename}
        currentName={renameInitialName}
        title={
          renameTarget?.type === "item" ? "Rename Item" : "Rename Playlist"
        }
      />
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={
          pendingDelete?.type === "item" ? "Delete Item" : "Delete Playlist"
        }
        message={
          pendingDelete
            ? pendingDelete.type === "item"
              ? `Are you sure you want to delete item "${pendingDelete.name}"?`
              : `Are you sure you want to delete playlist "${pendingDelete.name}" and all its items?`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={performPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <TypingUrlModal
        isOpen={!!typingUrlModal}
        url={typingUrlModal?.url || ""}
        onClose={() => setTypingUrlModal(null)}
      />
    </div>
  );
};

export default MainApplicationPage;
