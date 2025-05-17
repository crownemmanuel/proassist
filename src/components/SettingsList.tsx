import React, { useState } from "react";
import { Template, TemplateType, LayoutType } from "../types";
import "../App.css"; // Ensure global styles are applied

interface SettingsListProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onAddTemplate: (newTemplate: Omit<Template, "id">) => void;
  onDeleteTemplate: (templateId: string) => void;
}

const SettingsList: React.FC<SettingsListProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onAddTemplate,
  onDeleteTemplate,
}) => {
  // For a simplified add form (can be expanded into a modal or separate component)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] =
    useState<TemplateType>("Simple");
  const [newTemplateColor, setNewTemplateColor] = useState("#cccccc"); // Default color for new template

  const handleInitiateAdd = () => {
    setShowAddForm(true);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewTemplateName("");
    setNewTemplateType("Simple");
    setNewTemplateColor("#cccccc");
  };

  const handleAddTemplateClick = () => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    const newTemp: Omit<Template, "id"> = {
      name: newTemplateName.trim(),
      color: newTemplateColor,
      type: newTemplateType,
      logic: "", // Default logic based on type
      availableLayouts: ["one-line"], // Default layout
    };
    onAddTemplate(newTemp);
    handleCancelAdd(); // Reset form
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
        {!showAddForm && (
          <button onClick={handleInitiateAdd} title="Add new template">
            +
          </button>
        )}
      </div>

      {showAddForm && (
        <div
          style={{
            border: "1px solid var(--app-border-color)",
            padding: "15px",
            marginBottom: "15px",
            borderRadius: "4px",
          }}
        >
          <h5 style={{ marginTop: 0, marginBottom: "10px" }}>
            Add New Template
          </h5>
          <input
            type="text"
            placeholder="Template Name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            style={{ marginBottom: "10px" }}
          />
          <select
            value={newTemplateType}
            onChange={(e) => setNewTemplateType(e.target.value as TemplateType)}
            style={{ marginBottom: "10px" }}
          >
            <option value="Simple">Simple</option>
            <option value="Regex">Regex</option>
            <option value="JavaScript Formula">JavaScript Formula</option>
            <option value="AI Powered">AI Powered</option>
          </select>
          <div style={{ marginBottom: "15px" }}>
            <label
              htmlFor="newTemplateColor"
              style={{ marginRight: "5px", fontSize: "0.9em" }}
            >
              Color:
            </label>
            <input
              type="color"
              id="newTemplateColor"
              value={newTemplateColor}
              onChange={(e) => setNewTemplateColor(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={handleAddTemplateClick} className="primary">
              Add Template
            </button>
            <button onClick={handleCancelAdd}>Cancel</button>
          </div>
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
        {templates.length === 0 && !showAddForm && (
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
            onClick={() => onSelectTemplate(template.id)}
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
