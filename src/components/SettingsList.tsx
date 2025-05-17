import React, { useState } from "react";
import { Template, TemplateType, LayoutType } from "../types";
import "../App.css"; // Ensure global styles are applied

interface SettingsListProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: Template) => void;
  onAddTemplate: (newTemplateData: Omit<Template, "id">) => void;
  onDeleteTemplate: (templateId: string) => void;
}

const SettingsList: React.FC<SettingsListProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onAddTemplate,
  onDeleteTemplate,
}) => {
  // State for the "Add New Template" form inline in the list
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TemplateType>("text");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newAvailableLayouts, setNewAvailableLayouts] = useState<LayoutType[]>(
    []
  );
  const [newAIPrompt, setNewAIPrompt] = useState("");
  const [newProcessWithAI, setNewProcessWithAI] = useState(false);
  const [newOutputPath, setNewOutputPath] = useState("");
  const [newOutputPrefix, setNewOutputPrefix] = useState("");

  const allLayoutTypes: LayoutType[] = [
    "one-line",
    "two-line",
    "three-line",
    "four-line",
    "five-line",
    "six-line",
  ];

  const handleAddNewTemplate = () => {
    if (!newName.trim() || !newOutputPath.trim() || !newOutputPrefix.trim()) {
      alert("Template name, output path, and output prefix are required.");
      return;
    }
    // Call the prop with the new template data object
    onAddTemplate({
      name: newName,
      type: newType,
      color: newColor,
      availableLayouts: newAvailableLayouts,
      aiPrompt: newAIPrompt,
      processWithAI: newProcessWithAI,
      logic: "", // Default logic, can be expanded in SettingsDetail
      outputPath: newOutputPath,
      outputFileNamePrefix: newOutputPrefix,
    });
    // Reset form and hide
    setIsAdding(false);
    setNewName("");
    setNewType("text");
    setNewColor("#ffffff");
    setNewAvailableLayouts([]);
    setNewAIPrompt("");
    setNewProcessWithAI(false);
    setNewOutputPath("");
    setNewOutputPrefix("");
  };

  const toggleLayout = (layout: LayoutType) => {
    setNewAvailableLayouts((prev) =>
      prev.includes(layout)
        ? prev.filter((l) => l !== layout)
        : [...prev, layout]
    );
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h4>Templates</h4>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            style={{ width: "100%", marginTop: "10px" }}
          >
            ＋ Add New Template
          </button>
        )}
      </div>

      {isAdding && (
        <div
          className="add-template-form"
          style={{
            marginTop: "15px",
            borderTop: "1px solid var(--app-border-color)",
            paddingTop: "15px",
          }}
        >
          <h4>New Template Details</h4>
          <input
            type="text"
            placeholder="Template Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as TemplateType)}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <label
            htmlFor="template-color"
            style={{ display: "block", marginTop: "5px" }}
          >
            Color:
          </label>
          <input
            type="color"
            id="template-color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ marginLeft: "5px" }}
          />
          <div style={{ margin: "10px 0" }}>
            <label>Available Layouts:</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              {allLayoutTypes.map((layout) => (
                <button
                  key={layout}
                  onClick={() => toggleLayout(layout)}
                  className={
                    newAvailableLayouts.includes(layout)
                      ? "chip-selected"
                      : "chip"
                  }
                  style={{ fontSize: "0.8em", padding: "3px 6px" }}
                >
                  {layout.replace("-line", "")}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="Output Path (e.g., /Users/path/to/folder)"
            value={newOutputPath}
            onChange={(e) => setNewOutputPath(e.target.value)}
            title="Full path to the directory where files will be saved."
          />
          <input
            type="text"
            placeholder="Output File Name Prefix (e.g., SongTitle)"
            value={newOutputPrefix}
            onChange={(e) => setNewOutputPrefix(e.target.value)}
            title="Prefix for the filenames, e.g., 'SongTitle' results in SongTitle1.txt, SongTitle2.txt"
          />
          <div>
            <input
              type="checkbox"
              id="process-with-ai"
              checked={newProcessWithAI}
              onChange={(e) => setNewProcessWithAI(e.target.checked)}
            />
            <label htmlFor="process-with-ai" style={{ marginLeft: "5px" }}>
              Process with AI
            </label>
          </div>
          {newProcessWithAI && (
            <textarea
              placeholder="AI Prompt (e.g., Summarize this text for a lower third)"
              value={newAIPrompt}
              onChange={(e) => setNewAIPrompt(e.target.value)}
              rows={3}
            />
          )}
          <button
            onClick={handleAddNewTemplate}
            className="primary"
            style={{ marginRight: "5px" }}
          >
            Save Template
          </button>
          <button onClick={() => setIsAdding(false)}>Cancel</button>
        </div>
      )}

      <ul
        style={{
          listStyleType: "none",
          padding: 0,
          margin: 0,
          border: "1px solid var(--app-border-color)",
          borderRadius: "4px",
        }}
      >
        {templates.length === 0 && !isAdding && (
          <li
            className="list-item"
            style={{ color: "var(--app-text-color-secondary)" }}
          >
            No templates. Click + to add.
          </li>
        )}
        {templates.map((template) => (
          <li
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={`list-item ${
              template.id === selectedTemplateId ? "selected" : ""
            }`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: template.color,
                  marginRight: "8px",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "3px",
                }}
              ></span>
              {template.name}
              <span
                style={{
                  fontSize: "0.8em",
                  marginLeft: "5px",
                  color:
                    template.id === selectedTemplateId
                      ? "var(--app-list-item-selected-text)"
                      : "var(--app-text-color-secondary)",
                }}
              >
                ({template.type})
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  window.confirm(
                    `Are you sure you want to delete template "${template.name}"?`
                  )
                ) {
                  onDeleteTemplate(template.id);
                }
              }}
              title="Delete template"
              style={{
                padding: "3px 8px",
                fontSize: "0.8em",
                background: "transparent",
                color: "var(--app-text-color-secondary)",
              }}
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SettingsList;
