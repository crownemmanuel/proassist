import React, { useState, useEffect } from "react";
import { PlaylistItem, Slide, LayoutType, Template } from "../types";
import { FaTrash, FaEdit, FaPlay, FaPlus } from "react-icons/fa";
import "../App.css"; // Ensure global styles are applied
import ContextMenu from "./ContextMenu"; // Import the new component

const MAX_LINES_FOR_EDIT = 6;

interface SlideDisplayAreaProps {
  playlistItem: PlaylistItem | undefined;
  template: Template | undefined;
  onUpdateSlide: (slideId: string, newText: string) => void;
  onMakeSlideLive: (slide: Slide) => void;
  onAddSlide: (layout: LayoutType) => void;
  onDeleteSlide: (slideId: string) => void;
  onChangeSlideLayout: (slideId: string, newLayout: LayoutType) => void; // New prop
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  slideId: string | null;
}

const SlideDisplayArea: React.FC<SlideDisplayAreaProps> = ({
  playlistItem,
  template,
  onUpdateSlide,
  onMakeSlideLive,
  onAddSlide,
  onDeleteSlide,
  onChangeSlideLayout, // New prop
}) => {
  // Mark unused prop as intentionally unused to satisfy TypeScript
  void template;
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  // editText is now used as a temporary holder if needed, or can be removed if editingLines is sufficient
  // For simplicity, we'll manage lines directly.
  const [editingLines, setEditingLines] = useState<string[]>([]);
  const [liveSlideId, setLiveSlideId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    slideId: null,
  });

  useEffect(() => {
    setEditingSlideId(null);
    setEditingLines([]);
    setContextMenu({ isOpen: false, x: 0, y: 0, slideId: null }); // Close context menu on item change
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

    const currentLines = slide.text.split("\n");
    const actualLinesCount = currentLines.length;

    let minLinesForLayout: number;
    switch (slide.layout) {
      case "one-line":
        minLinesForLayout = 1;
        break;
      case "two-line":
        minLinesForLayout = 2;
        break;
      case "three-line":
        minLinesForLayout = 3;
        break;
      case "four-line":
        minLinesForLayout = 4;
        break;
      case "five-line":
        minLinesForLayout = 5;
        break;
      case "six-line":
        minLinesForLayout = 6;
        break;
      default:
        // Fallback for any layout string not explicitly handled.
        // This ensures we always have a sensible minimum, defaulting to 1.
        // const _exhaustiveCheck: never = slide.layout; // For type checking if all cases are handled
        minLinesForLayout = 1;
    }

    // Determine the number of input fields:
    // Show at least the number of lines implied by minLinesForLayout.
    // If actualLinesCount is greater, show that many, up to MAX_LINES_FOR_EDIT.
    // If actualLinesCount is less, still show minLinesForLayout (padded with empty strings if they are edited).
    const numFields = Math.min(
      Math.max(minLinesForLayout, actualLinesCount),
      MAX_LINES_FOR_EDIT
    );

    setEditingLines(
      Array(numFields)
        .fill("")
        .map((_, i) => currentLines[i] || "")
    );
    closeContextMenu(); // Close context menu when edit starts
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

  const handleRightClick = (event: React.MouseEvent, slideId: string) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      slideId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, slideId: null });
  };

  // Note: currentEditingSlide is not used currently; keeping the lookup inline where needed avoids unused var.
  const currentContextMenuSlide = playlistItem?.slides.find(
    (s) => s.id === contextMenu.slideId
  );

  const allLayoutOptions: LayoutType[] = [
    "one-line",
    "two-line",
    "three-line",
    "four-line",
    "five-line",
    "six-line",
  ];

  // removed unused variable 'availableLayouts'

  const contextMenuItems = currentContextMenuSlide
    ? [
        { label: "Edit", onClick: () => handleEdit(currentContextMenuSlide) },
        {
          label: "Delete",
          onClick: () => {
            if (currentContextMenuSlide) {
              onDeleteSlide(currentContextMenuSlide.id);
            }
          },
        },
      ]
    : [];

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
            onContextMenu={(e) => handleRightClick(e, slide.id)}
          >
            <div className="slide-layout-picker-container">
              <select
                className="slide-layout-picker"
                value={slide.layout}
                onChange={(e) =>
                  onChangeSlideLayout(slide.id, e.target.value as LayoutType)
                }
                onClick={(e) => e.stopPropagation()} // Prevent card click-through
              >
                {allLayoutOptions.map((layout) => (
                  <option key={layout} value={layout}>
                    {getLayoutText(layout)}
                  </option>
                ))}
              </select>
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
                    autoFocus={index === 0} // Auto-focus first line on edit
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
                  <button
                    className="secondary"
                    onClick={() => handleEdit(slide)}
                  >
                    <FaEdit />
                    Edit
                  </button>
                  <button
                    onClick={() => handleMakeLive(slide)}
                    className={
                      liveSlideId === slide.id ? "live-active" : "primary"
                    }
                    disabled={liveSlideId === slide.id}
                  >
                    <FaPlay />
                    {liveSlideId === slide.id ? "Live" : "Go Live"}
                  </button>
                  <button
                    onClick={() => onDeleteSlide(slide.id)}
                    className="icon-button"
                    title="Delete slide"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      {playlistItem && (
        <div
          style={{
            marginTop: "20px",
            borderTop: "1px solid var(--app-border-color)",
            paddingTop: "20px",
          }}
        >
          <h5
            style={{
              marginTop: 0,
              marginBottom: "10px",
              color: "var(--app-text-color-secondary)",
            }}
          >
            Add New Slide:
          </h5>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {allLayoutOptions.map((layout) => (
              <button
                key={layout}
                onClick={() => onAddSlide(layout)}
                className="secondary btn-sm"
                title={`Add ${getLayoutText(layout)} Slide`}
              >
                <FaPlus />
                {getLayoutText(layout)}
              </button>
            ))}
          </div>
        </div>
      )}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        menuItems={contextMenuItems}
        onClose={closeContextMenu}
      />
    </div>
  );
};

export default SlideDisplayArea;
