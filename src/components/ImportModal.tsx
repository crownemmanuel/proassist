import React, { useState, useEffect } from "react";
import { Template, LayoutType, PlaylistItem, Slide } from "../types";
import "../App.css"; // Ensure global styles are applied

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[]; // To select a template for parsing
  onImportComplete: (
    newPlaylistItemTitle: string,
    slides: Slide[],
    templateName: string,
    templateColor: string
  ) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  templates,
  onImportComplete,
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [playlistItemTitle, setPlaylistItemTitle] = useState("Imported Item"); // User can name the new playlist item
  const [parsedSlidesPreview, setParsedSlidesPreview] = useState<Slide[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen && templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
    if (!isOpen) {
      // Reset state when modal closes
      setShowPreview(false);
      setParsedSlidesPreview([]);
    }
  }, [isOpen, templates, selectedTemplateId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setInputText(""); // Clear text input if file is selected
      setShowPreview(false);
    }
  };

  const handleTextPaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    // Optionally, could directly set inputText from paste here
    // setInputText(event.clipboardData.getData('text'));
  };

  const runParsingLogic = (
    textToProcess: string,
    template: Template
  ): Slide[] => {
    // TODO: Implement full parsing logic based on selectedTemplate.type
    console.log(
      `Processing with template: ${template.name} (${template.type})`
    );
    console.log(`Logic: ${template.logic}`);
    console.log(`Available Layouts: ${template.availableLayouts.join(", ")}`);

    // Simple split by double newline as a basic example
    const rawSlides = textToProcess.split(/\n\s*\n/);
    return rawSlides.map((text, index) => ({
      id: `imported-slide-${Date.now()}-${index}`,
      text: text.trim(),
      layout: template.availableLayouts[0] || "one-line",
      order: index + 1,
    }));
  };

  const handlePreview = async () => {
    let textToProcess = inputText;
    if (selectedFile) {
      textToProcess = await selectedFile.text();
    }
    if (!textToProcess.trim()) {
      alert("No content to preview.");
      return;
    }
    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
    if (!selectedTemplate) {
      alert("Please select a template.");
      return;
    }
    const slides = runParsingLogic(textToProcess, selectedTemplate);
    setParsedSlidesPreview(slides);
    setShowPreview(true);
  };

  const handleSaveToPlaylist = () => {
    if (!parsedSlidesPreview.length && !showPreview) {
      alert(
        "Please preview the import first or ensure there is content to save."
      );
      // Optionally, could call handlePreview here first if content exists
      return;
    }
    // If preview wasn't explicitly clicked but content and template are valid, parse again.
    // This path might be hit if user fills form and directly clicks "Save to Playlist"
    let slidesToSave = parsedSlidesPreview;
    if (!showPreview) {
      let textToProcess = inputText;
      // We need to re-read file if it was selected and not yet parsed into preview
      // However, selectedFile.text() is async, this flow needs careful thought for UX.
      // For now, assume if preview not shown, text input is the source or file already read to inputText.
      if (selectedFile && !inputText) {
        // This case is tricky, ideally preview is mandatory
        alert("File selected but not previewed. Please preview first.");
        return;
      }
      const selectedTemplate = templates.find(
        (t) => t.id === selectedTemplateId
      );
      if (!selectedTemplate || !textToProcess.trim()) {
        alert("Missing content or template for saving.");
        return;
      }
      slidesToSave = runParsingLogic(textToProcess, selectedTemplate);
    }

    if (!slidesToSave.length) {
      alert("No slides were generated to save.");
      return;
    }

    const finalTemplate = templates.find((t) => t.id === selectedTemplateId)!; // Should exist if we got here
    onImportComplete(
      playlistItemTitle,
      slidesToSave,
      finalTemplate.name,
      finalTemplate.color
    );
    handleModalClose();
  };

  const handleModalClose = () => {
    setInputText("");
    setSelectedFile(null);
    setPlaylistItemTitle("Imported Item");
    if (templates.length > 0) setSelectedTemplateId(templates[0].id);
    setShowPreview(false);
    setParsedSlidesPreview([]);
    onClose();
  };

  if (!isOpen) return null;

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    fontWeight: 500,
    color: "var(--app-text-color-secondary)",
  };
  const formRowStyle: React.CSSProperties = { marginBottom: "15px" };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2
          style={{
            marginTop: 0,
            borderBottom: "1px solid var(--app-border-color)",
            paddingBottom: "10px",
            marginBottom: "20px",
          }}
        >
          Import Content
        </h2>

        <div style={formRowStyle}>
          <label htmlFor="playlistItemTitle" style={labelStyle}>
            New Item Title:
          </label>
          <input
            type="text"
            id="playlistItemTitle"
            value={playlistItemTitle}
            onChange={(e) => setPlaylistItemTitle(e.target.value)}
          />
        </div>

        <div style={formRowStyle}>
          <label htmlFor="templateSelect" style={labelStyle}>
            Select Template:
          </label>
          <select
            id="templateSelect"
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              setShowPreview(false);
            }}
            disabled={templates.length === 0}
          >
            {templates.length === 0 && <option>No templates available</option>}
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.type})
              </option>
            ))}
          </select>
        </div>

        <div style={formRowStyle}>
          <label htmlFor="fileInput" style={labelStyle}>
            Upload File (.txt):
          </label>
          <input
            type="file"
            id="fileInput"
            accept=".txt"
            onChange={handleFileChange}
          />
        </div>

        <div style={{ ...formRowStyle, marginBottom: "5px" }}>
          <label htmlFor="textInput" style={labelStyle}>
            Or Paste Text:
          </label>
        </div>
        <textarea
          id="textInput"
          rows={6}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (selectedFile) setSelectedFile(null);
            setShowPreview(false);
          }}
          onPaste={handleTextPaste}
          placeholder="Paste your text content here..."
          disabled={!!selectedFile}
          style={{ marginBottom: "10px" }}
        />

        {showPreview && parsedSlidesPreview.length > 0 && (
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              border: "1px solid var(--app-border-color)",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "4px",
            }}
          >
            <h5 style={{ marginTop: 0, marginBottom: "5px" }}>
              Preview ({parsedSlidesPreview.length} slides):
            </h5>
            {parsedSlidesPreview.map((slide) => (
              <div
                key={slide.id}
                style={{
                  fontSize: "0.85em",
                  padding: "3px 0",
                  borderBottom: "1px dashed var(--app-border-color)",
                }}
              >
                <strong>Layout: {slide.layout}</strong> -{" "}
                {slide.text.substring(0, 100)}
                {slide.text.length > 100 ? "..." : ""}
              </div>
            ))}
          </div>
        )}
        {showPreview && parsedSlidesPreview.length === 0 && (
          <p
            style={{
              color: "var(--app-text-color-secondary)",
              fontSize: "0.9em",
              marginBottom: "15px",
            }}
          >
            No slides generated from the input with the selected template.
          </p>
        )}

        <div
          style={{
            marginTop: "20px",
            textAlign: "right",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={handlePreview}
            disabled={
              (!inputText.trim() && !selectedFile) || !selectedTemplateId
            }
          >
            Preview
          </button>
          <button
            onClick={handleSaveToPlaylist}
            className="primary"
            disabled={
              !selectedTemplateId ||
              (!showPreview && !inputText.trim() && !selectedFile) ||
              (showPreview && !parsedSlidesPreview.length)
            }
          >
            Save to Playlist
          </button>
          <button onClick={handleModalClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// Modal styles (modalOverlayStyle, modalContentStyle) should be defined in App.css or inherited.
// For now, I will copy them here and ensure they are dark-mode friendly.

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "var(--app-modal-overlay-bg)", // Using CSS Variable
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "var(--app-bg-color)",
  color: "var(--app-text-color)",
  padding: "25px",
  borderRadius: "8px",
  width: "90%",
  maxWidth: "700px",
  border: "1px solid var(--app-border-color)",
  boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
};

export default ImportModal;
