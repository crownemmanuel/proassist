import React from "react";
import { Template } from "../types";
import {
  FaPlus,
  FaFileExport,
  FaFileImport,
  FaChevronRight,
  FaTrash,
} from "react-icons/fa";

interface TemplateListViewProps {
  templates: Template[];
  selectedTemplates: string[];
  onSelectTemplate: (id: string) => void;
  onEditTemplate: (id: string) => void;
  onAddTemplate: () => void;
  onImport: () => void;
  onExportAll: () => void;
  onExportSelected: () => void;
  hasSelection: boolean;
  onDeleteTemplate: (id: string) => void;
}

const TemplateListView: React.FC<TemplateListViewProps> = ({
  templates,
  selectedTemplates,
  onSelectTemplate,
  onEditTemplate,
  onAddTemplate,
  onImport,
  onExportAll,
  onExportSelected,
  hasSelection,
  onDeleteTemplate,
}) => {
  return (
    <div className="template-list-view">
      <div className="template-list-header">
        <h2>Manage Templates</h2>
        <div className="header-actions">
          <button onClick={onExportAll} className="secondary">
            <FaFileExport /> Export All
          </button>
          <button
            onClick={onExportSelected}
            className="secondary"
            disabled={!hasSelection}
          >
            <FaFileExport /> Export Selected
          </button>
          <button onClick={onImport} className="secondary">
            <FaFileImport /> Import
          </button>
          <button onClick={onAddTemplate} className="primary-green">
            <FaPlus /> Add Template
          </button>
        </div>
      </div>
      <div className="template-list">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-list-item ${
              selectedTemplates.includes(template.id) ? "selected" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selectedTemplates.includes(template.id)}
              onChange={() => onSelectTemplate(template.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              className="template-list-item-content"
              onClick={() => onEditTemplate(template.id)}
            >
              <div
                className="template-icon"
                style={{ backgroundColor: template.color }}
              >
                {/* Placeholder for an actual icon */}
                <span>{template.icon?.slice(0, 2) || "T"}</span>
              </div>
              <span className="template-name">{template.name}</span>
              <FaChevronRight className="chevron" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTemplate(template.id);
              }}
              className="icon-button danger"
            >
              <FaTrash />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateListView;
