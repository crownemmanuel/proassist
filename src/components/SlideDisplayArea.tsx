import React, { useState, useEffect } from "react";
import { PlaylistItem, Slide, LayoutType } from "../types";
import "../App.css"; // Ensure global styles are applied

const MAX_LINES_FOR_EDIT = 6;

interface SlideDisplayAreaProps {
  playlistItem: PlaylistItem | undefined;
  onUpdateSlide: (slideId: string, newText: string) => void;
  onMakeSlideLive: (slide: Slide) => void;
}

const SlideDisplayArea: React.FC<SlideDisplayAreaProps> = ({
  playlistItem,
  onUpdateSlide,
  onMakeSlideLive,
}) => {
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  // editText is now used as a temporary holder if needed, or can be removed if editingLines is sufficient
  // For simplicity, we'll manage lines directly.
  const [editingLines, setEditingLines] = useState<string[]>([]);
  const [liveSlideId, setLiveSlideId] = useState<string | null>(null);

  useEffect(() => {
    setEditingSlideId(null);
    setEditingLines([]);
  }, [playlistItem]);

  const getLayoutText = (layout: LayoutType): string => {
    switch (layout) {
      case "one-line":
        return "One Line";
      case "two-line":
        return "Two Lines";
      case "three-line":
        return "Three Lines";
      case "four-line":
        return "Four Lines";
      case "five-line":
        return "Five Lines";
      case "six-line":
        return "Six Lines";
      default:
        // This case should ideally not be reached if `layout` is always a valid LayoutType
        // and all LayoutTypes are handled above.
        // If layout can somehow be a string not in LayoutType, this will try to format it.
        const layoutStr = layout as string; // Type assertion
        return layoutStr
          .replace("-", " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
  };

  const handleEdit = (slide: Slide) => {
    setEditingSlideId(slide.id);
    // Determine number of input fields based on slide.layout or MAX_LINES_FOR_EDIT
    let numFields = 1;
    switch (slide.layout) {
      case "one-line":
        numFields = 1;
        break;
      case "two-line":
        numFields = 2;
        break;
      case "three-line":
        numFields = 3;
        break;
      case "four-line":
        numFields = 4;
        break;
      case "five-line":
        numFields = 5;
        break;
      case "six-line":
        numFields = 6;
        break;
      default: {
        const actualLines = slide.text.split("\n").length;
        numFields = Math.max(1, Math.min(actualLines, MAX_LINES_FOR_EDIT));
      }
    }

    const currentLines = slide.text.split("\n");
    setEditingLines(
      Array(numFields)
        .fill("")
        .map((_, i) => currentLines[i] || "")
    );
  };

  const handleEditingLineChange = (index: number, value: string) => {
    const newLines = [...editingLines];
    newLines[index] = value;
    setEditingLines(newLines);
  };

  const handleSave = (slideId: string) => {
    // Join lines, but trim trailing empty lines to avoid altering slide structure unnecessarily
    let lastNonEmptyIndex = editingLines.length - 1;
    while (
      lastNonEmptyIndex >= 0 &&
      editingLines[lastNonEmptyIndex].trim() === ""
    ) {
      lastNonEmptyIndex--;
    }
    const newText = editingLines.slice(0, lastNonEmptyIndex + 1).join("\n");
    onUpdateSlide(slideId, newText);
    setEditingSlideId(null);
    setEditingLines([]);
  };

  const handleCancelEdit = () => {
    setEditingSlideId(null);
    setEditingLines([]);
  };

  const handleMakeLive = (slide: Slide) => {
    onMakeSlideLive(slide);
    setLiveSlideId(slide.id);
  };

  // Simple text area styling, can be moved to CSS if not already there
  // Individual input styling can also be added to App.css
  const singleInputStyle: React.CSSProperties = {
    width: "100%", // Inputs will take full width of their container
    padding: "0.7em 1em",
    marginBottom: "8px",
    fontSize: "0.9em",
    fontFamily: "inherit",
    color: "var(--app-input-text-color)",
    backgroundColor: "var(--app-input-bg-color)",
    border: "1px solid var(--app-border-color)",
    borderRadius: "6px",
    boxSizing: "border-box",
  };

  if (!playlistItem) {
    return (
      <p style={{ color: "var(--app-text-color-secondary)" }}>
        Select an item from a playlist to see its slides.
      </p>
    );
  }

  return (
    <div>
      {playlistItem.slides.length === 0 && (
        <p style={{ color: "var(--app-text-color-secondary)" }}>
          This item has no slides.
        </p>
      )}
      {playlistItem.slides
        .sort((a, b) => a.order - b.order)
        .map((slide) => (
          <div
            key={slide.id}
            className={`slide-item-card ${
              liveSlideId === slide.id ? "live" : ""
            }`}
          >
            <div className="slide-layout-badge">
              {getLayoutText(slide.layout)}
            </div>
            {editingSlideId === slide.id ? (
              <div style={{ width: "100%", paddingTop: "20px" }}>
                {" "}
                {/* Added paddingTop to avoid badge overlap */}
                {editingLines.map((line, index) => (
                  <input
                    key={index}
                    type="text"
                    value={line}
                    onChange={(e) =>
                      handleEditingLineChange(index, e.target.value)
                    }
                    placeholder={`Line ${index + 1}`}
                    style={singleInputStyle}
                  />
                ))}
                <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                  <button
                    onClick={() => handleSave(slide.id)}
                    className="primary"
                  >
                    Save
                  </button>
                  <button onClick={handleCancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ width: "100%", paddingTop: "20px" }}>
                {" "}
                {/* Added paddingBottom to ensure space for buttons if text is short*/}
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    marginBottom: "10px",
                    minHeight: "40px",
                  }}
                >
                  {slide.text || (
                    <span style={{ color: "var(--app-text-color-secondary)" }}>
                      (Empty Slide)
                    </span>
                  )}
                </div>
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "auto" }}
                >
                  <button onClick={() => handleEdit(slide)}>Edit</button>
                  <button
                    onClick={() => handleMakeLive(slide)}
                    className={liveSlideId === slide.id ? "live-active" : ""}
                    disabled={liveSlideId === slide.id}
                  >
                    {liveSlideId === slide.id ? "● Live" : "Go Live"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
};

export default SlideDisplayArea;
