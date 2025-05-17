import React, { useState } from "react";
import PlaylistPane from "../components/PlaylistPane";
import SlideDisplayArea from "../components/SlideDisplayArea";
import ImportModal from "../components/ImportModal";
import {
  Playlist,
  PlaylistItem,
  Slide,
  Template,
  TemplateType,
} from "../types"; // Using types defined earlier
import "../App.css"; // Ensure global styles are applied
import { invoke } from "@tauri-apps/api/core"; // Corrected import path for Tauri v2

// Mock Data (can be moved to a separate file or fetched from backend later)
const mockPlaylistsData: Playlist[] = [
  {
    id: "playlist1",
    name: "Sunday Service - AM",
    items: [
      {
        id: "item1-1",
        title: "Worship Set 1",
        templateName: "Simple Line Break",
        templateColor: "#4CAF50",
        slides: [
          {
            id: "slide1-1-1",
            text: "Welcome to the service!",
            layout: "one-line",
            order: 1,
          },
          {
            id: "slide1-1-2",
            text: "Amazing Grace\nHow sweet the sound",
            layout: "two-line",
            order: 2,
          },
        ],
      },
      {
        id: "item1-2",
        title: "Sermon Slides",
        templateName: "Sermon Regex",
        templateColor: "#2196F3",
        slides: [
          {
            id: "slide1-2-1",
            text: "Sermon Title: The Power of Prayer",
            layout: "one-line",
            order: 1,
          },
          {
            id: "slide1-2-2",
            text: "Point 1: Why we pray\nPoint 2: How to pray",
            layout: "two-line",
            order: 2,
          },
        ],
      },
    ],
  },
  {
    id: "playlist2",
    name: "Midweek Study",
    items: [
      {
        id: "item2-1",
        title: "Romans Study",
        templateName: "JS Scripture Splitter",
        templateColor: "#FFC107",
        slides: [
          {
            id: "slide2-1-1",
            text: "Romans 1:1",
            layout: "one-line",
            order: 1,
          },
          {
            id: "slide2-1-2",
            text: "Paul, a servant of Christ Jesus",
            layout: "one-line",
            order: 2,
          },
        ],
      },
    ],
  },
];

// Mock Templates Data (ensure this matches structure in SettingsPage or is fetched/shared)
// For this change, it's CRITICAL that the templates here have outputPath and outputFileNamePrefix
// Consider a shared source for templates if not already done.
const mockTemplatesForMainPage: Template[] = [
  // Duplicating for clarity, ideally from shared state
  {
    id: "tpl1",
    name: "Simple Line Break",
    color: "#4CAF50",
    type: "Simple",
    logic: "Line Break",
    availableLayouts: ["one-line", "two-line"],
    outputPath: "/tmp/proassist/output/simple/",
    outputFileNamePrefix: "simple_slide_",
  },
  {
    id: "tpl2",
    name: "Sermon Regex",
    color: "#2196F3",
    type: "Regex",
    logic: "/^VERSE\\s*(\\d+[:\\d,-]*)\\s*([\\s\\S]*?)(?=\\n\\n|$)/gm",
    availableLayouts: ["one-line", "two-line", "three-line"],
    outputPath: "/tmp/proassist/output/sermon/",
    outputFileNamePrefix: "sermon_note_",
  },
  {
    id: "tpl3",
    name: "JS Scripture Splitter",
    color: "#FFC107",
    type: "JavaScript Formula",
    logic: '// Example JS: item.text.split("\\\\n---\\\\n");',
    availableLayouts: ["one-line", "two-line"],
    outputPath: "/tmp/proassist/output/scripture/",
    outputFileNamePrefix: "scripture_passage_",
  },
  {
    id: "tpl4",
    name: "AI Verse Grouping",
    color: "#E91E63",
    type: "AI Powered",
    logic: "Group verses into thematic slides...",
    availableLayouts: ["one-line", "two-line", "three-line", "four-line"],
    prompt: "Create slides for the following text...",
    outputPath: "/tmp/proassist/output/ai_verses/",
    outputFileNamePrefix: "ai_verse_slide_",
  },
];

const MainApplicationPage: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>(mockPlaylistsData);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    mockPlaylistsData.length > 0 ? mockPlaylistsData[0].id : null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // Use the more complete mockTemplatesForMainPage or fetch/get from a shared store
  const [templates, setTemplates] = useState<Template[]>(() => {
    const savedTemplates = localStorage.getItem("proassist-templates");
    return savedTemplates
      ? JSON.parse(savedTemplates)
      : mockTemplatesForMainPage; // Use the more detailed one
  });

  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setSelectedItemId(null);
  };

  const handleSelectPlaylistItem = (itemId: string) => {
    setSelectedItemId(itemId);
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
      // Optionally, provide user feedback on success
      alert(
        `Slide content for "${slide.id}" (up to ${linesToWrite} lines) has been processed for live output.`
      );
    } catch (error) {
      console.error("Failed to write slide content to file(s):", error);
      alert("Error making slide live. Check console for details.");
    }
    // Note: The visual feedback (setting liveSlideId in SlideDisplayArea) is handled locally in that component.
    // This function focuses on the side effect (writing to files).
  };

  const handleImportComplete = (
    newPlaylistItemTitle: string,
    importedSlides: Slide[],
    templateNameUsed: string,
    templateColorUsed: string
  ) => {
    if (!selectedPlaylistId) {
      alert("No playlist selected to add the imported item to.");
      return;
    }
    const newPlaylistItem: PlaylistItem = {
      id: `item-${Date.now()}`,
      title: newPlaylistItemTitle,
      slides: importedSlides,
      templateName: templateNameUsed,
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
    setSelectedItemId(newPlaylistItem.id); // Select the newly imported item
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
    padding: "10px",
    backgroundColor: "var(--app-bg-color)", // Or a slightly different shade like var(--app-header-bg)
  };

  const rightColumnStyle: React.CSSProperties = {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    backgroundColor: "var(--app-bg-color)",
  };

  const rightColumnHeaderStyle: React.CSSProperties = {
    padding: "10px 20px",
    borderBottom: "1px solid var(--app-border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--app-header-bg)", // Use header background
    color: "var(--app-text-color)",
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
          <h3 style={{ margin: 0, fontWeight: 500 }}>
            {currentPlaylist
              ? `${
                  currentPlaylistItem
                    ? currentPlaylistItem.title
                    : currentPlaylist.name
                }`
              : "Select a Playlist"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 500, fontSize: "0.9em" }}>Import</span>
            <button
              onClick={() => {
                if (currentPlaylist) {
                  setIsImportModalOpen(true);
                } else {
                  alert("Please select a playlist first.");
                }
              }}
              disabled={!currentPlaylist}
              className="import-button-round-purple"
              title={`Import to "${currentPlaylist?.name || "Playlist"}"`}
            >
              ➕
            </button>
          </div>
        </div>
        <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}>
          <SlideDisplayArea
            playlistItem={currentPlaylistItem}
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
          />
        </div>
      </div>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templates={templates}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default MainApplicationPage;
