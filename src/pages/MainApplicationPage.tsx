import React, { useEffect, useState } from "react";
import PlaylistPane from "../components/PlaylistPane";
import SlideDisplayArea from "../components/SlideDisplayArea";
import ImportModal from "../components/ImportModal";
import RenameModal from "../components/RenameModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { Playlist, PlaylistItem, Slide, Template, LayoutType } from "../types"; // Using types defined earlier
import { FaFileImport, FaEdit, FaTrash, FaCopy } from "react-icons/fa";
import "../App.css"; // Ensure global styles are applied
import { invoke } from "@tauri-apps/api/core"; // Tauri v2 core invoke
import { formatSlidesForClipboard } from "../utils/slideUtils"; // Added import

const MainApplicationPage: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem("proassist-playlists");
      return saved ? (JSON.parse(saved) as Playlist[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copyStatusMain, setCopyStatusMain] = useState<string>(""); // Added state for feedback
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
  // Use the more complete mockTemplatesForMainPage or fetch/get from a shared store
  const [templates] = useState<Template[]>(() => {
    const savedTemplates = localStorage.getItem("proassist-templates");
    return savedTemplates ? JSON.parse(savedTemplates) : [];
  });

  // Persist playlists to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("proassist-playlists", JSON.stringify(playlists));
    } catch (err) {
      console.error("Failed to save playlists:", err);
    }
  }, [playlists]);

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
    }
    setPendingDelete(null);
  };

  const currentPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const currentPlaylistItem = currentPlaylist?.items.find(
    (item) => item.id === selectedItemId
  );

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
    setPlaylists((prevPlaylists) =>
      prevPlaylists.map((playlist) => {
        if (playlist.id === playlistId) {
          return {
            ...playlist,
            items: playlist.items.map((item) => {
              if (item.id === itemId) {
                return {
                  ...item,
                  slides: item.slides.map((slide) =>
                    slide.id === slideId ? { ...slide, text: newText } : slide
                  ),
                };
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
    // Actual save logic will go here, potentially involving backend/Tauri calls
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

    // Find the template used by this playlistItem
    // This assumes playlistItem.templateName is reliable for lookup.
    // A more robust way would be storing templateId in PlaylistItem.
    const template = templates.find(
      (t) => t.name === playlistItem.templateName
    );

    if (!template) {
      console.error(
        `Template '${playlistItem.templateName}' not found for playlist item '${playlistItem.title}'.`
      );
      alert(`Error: Template definition not found for this item.`);
      return;
    }

    if (!template.outputPath || !template.outputFileNamePrefix) {
      console.error(
        `Template '${template.name}' is missing outputPath or outputFileNamePrefix.`
      );
      alert(
        `Error: Output path or file prefix is not configured for the template '${template.name}'.`
      );
      return;
    }

    console.log("Making slide live:", slide);
    console.log("Using template:", template.name);
    console.log(
      `Output Path: ${template.outputPath}, Prefix: ${template.outputFileNamePrefix}`
    );

    const lines = slide.text.split("\n");
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

    try {
      for (let i = 0; i < linesToWrite; i++) {
        const lineContent = lines[i] || ""; // Use empty string if line doesn't exist
        const filePath = `${template.outputPath.replace(/\/?$/, "/")}${
          template.outputFileNamePrefix
        }${i + 1}.txt`;

        console.log(`Writing to file: ${filePath}, Content: "${lineContent}"`);
        await invoke("write_text_to_file", { filePath, content: lineContent });
        // UNCOMMENT THE INVOKE CALL above once your Tauri backend command 'write_text_to_file' is ready.
        // Ensure your Tauri command creates directories if they don't exist or handles errors appropriately.
      }
      // Success: no UI notification required
    } catch (error) {
      console.error("Failed to write slide content to file(s):", error);
      alert("Error making slide live. Check console for details.");
    }
    // Note: The visual feedback (setting liveSlideId in SlideDisplayArea) is handled locally in that component.
    // This function focuses on the side effect (writing to files).
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

  const handleImportFromModal = (
    itemName: string,
    templateName: string,
    slidesFromModal: Pick<Slide, "text" | "layout">[]
  ) => {
    if (!selectedPlaylistId) {
      alert("No playlist selected to add the imported item to.");
      return;
    }

    const selectedTemplate = templates.find((t) => t.name === templateName);
    if (!selectedTemplate) {
      alert(`Template "${templateName}" not found. Cannot import.`);
      setIsImportModalOpen(false);
      return;
    }
    const templateColorUsed = selectedTemplate.color || "#808080";

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
  };

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
            {currentPlaylist && !currentPlaylistItem && (
              <button
                onClick={handleOpenRenameSelectedPlaylist}
                className="secondary btn-sm"
                title="Rename playlist"
              >
                <FaEdit />
                Edit
              </button>
            )}
            {currentPlaylist && !currentPlaylistItem && (
              <button
                onClick={handleDeleteSelectedPlaylist}
                className="secondary btn-sm"
                title="Delete playlist"
              >
                <FaTrash />
                Delete
              </button>
            )}
            {currentPlaylist && currentPlaylistItem && (
              <button
                onClick={handleOpenRenameSelectedItem}
                className="secondary btn-sm"
                title="Rename item"
              >
                <FaEdit />
                Edit
              </button>
            )}
            {currentPlaylist && currentPlaylistItem && (
              <button
                onClick={handleDeleteSelectedItem}
                className="secondary btn-sm"
                title="Delete item"
              >
                <FaTrash />
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                if (currentPlaylist) {
                  setIsImportModalOpen(true);
                } else {
                  alert("Please select a playlist first.");
                }
              }}
              disabled={!currentPlaylist}
              className="primary"
              title={`Import to "${currentPlaylist?.name || "Playlist"}"`}
            >
              <FaFileImport />
              Import
            </button>
            {currentPlaylistItem && currentPlaylistItem.slides.length > 0 && (
              <button
                onClick={handleCopyToClipboardMain}
                title="Copy all slides in this item to clipboard"
                className="secondary"
              >
                <FaCopy />
                Copy Slides
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
            onUpdateSlide={(slideId, newText) => {
              if (currentPlaylist && currentPlaylistItem) {
                handleUpdateSlide(
                  currentPlaylist.id,
                  currentPlaylistItem.id,
                  slideId,
                  newText
                );
              }
            }}
            onMakeSlideLive={(slide) =>
              handleMakeSlideLive(slide, currentPlaylistItem)
            }
            onAddSlide={handleAddSlide}
            onDeleteSlide={handleDeleteSlide}
            onChangeSlideLayout={handleChangeSlideLayout}
          />
        </div>
      </div>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templates={templates}
        onImport={handleImportFromModal}
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
    </div>
  );
};

export default MainApplicationPage;
