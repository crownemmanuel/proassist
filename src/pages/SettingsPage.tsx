import React, { useState, useEffect } from "react";
import SettingsList from "../components/SettingsList";
import SettingsDetail from "../components/SettingsDetail";
import { Template, AppSettings, TemplateType, LayoutType } from "../types";
import AISettingsForm from "../components/AISettingsForm";
import "../App.css"; // Ensure global styles are applied

// Mock initial settings data
const mockTemplatesData: Template[] = [
  {
    id: "tpl1",
    name: "Simple Line Break",
    color: "#4CAF50",
    type: "text",
    logic: "Line Break",
    availableLayouts: ["one-line", "two-line"],
    outputPath: "/tmp/proassist/output/simple/",
    outputFileNamePrefix: "simple_slide_",
    processWithAI: false,
  },
  {
    id: "tpl2",
    name: "Sermon Regex",
    color: "#2196F3",
    type: "text",
    logic: "/^VERSE\\s*(\\d+[:\\d,-]*)\\s*([\\s\\S]*?)(?=\\n\\n|$)/gm",
    availableLayouts: ["one-line", "two-line", "three-line"],
    outputPath: "/tmp/proassist/output/sermon/",
    outputFileNamePrefix: "sermon_note_",
    processWithAI: false,
  },
  {
    id: "tpl3",
    name: "JS Scripture Splitter",
    color: "#FFC107",
    type: "text",
    logic: '// Example JS: item.text.split("\\\\n---\\\\n");',
    availableLayouts: ["one-line", "two-line"],
    outputPath: "/tmp/proassist/output/scripture/",
    outputFileNamePrefix: "scripture_passage_",
    processWithAI: false,
  },
  {
    id: "tpl4",
    name: "AI Verse Grouping",
    color: "#E91E63",
    type: "text",
    logic:
      "Group verses into thematic slides. Assign a two-line layout for headings and one-line for body.",
    availableLayouts: ["one-line", "two-line", "three-line", "four-line"],
    aiPrompt: "Create slides for the following text...",
    processWithAI: true,
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    outputPath: "/tmp/proassist/output/ai_verses/",
    outputFileNamePrefix: "ai_verse_slide_",
  },
];

const initialAppSettings: AppSettings = {
  theme: "light",
};

type SettingsView = "templates" | "aiConfiguration";

const SettingsPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>(() => {
    const savedTemplates = localStorage.getItem("proassist-templates");
    return savedTemplates ? JSON.parse(savedTemplates) : mockTemplatesData;
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates.length > 0 ? templates[0].id : null
  );
  const [currentView, setCurrentView] = useState<SettingsView>("templates");

  useEffect(() => {
    localStorage.setItem("proassist-templates", JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    // If templates are loaded and no template is selected, or selected is invalid, select the first one.
    if (
      templates.length > 0 &&
      (!selectedTemplateId ||
        !templates.find((t) => t.id === selectedTemplateId))
    ) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleSaveTemplate = (updatedTemplate: Template) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );
    console.log("Saved template:", updatedTemplate);
  };

  const handleAddTemplate = (newTemplateData: {
    name: string;
    type: TemplateType;
    color: string;
  }) => {
    const newTemplate: Template = {
      id: `tpl-${Date.now()}`,
      ...newTemplateData,
      logic: newTemplateData.type === "text" ? "Default text logic/notes" : "",
      availableLayouts: ["one-line", "two-line"],
      aiPrompt: "",
      processWithAI: false,
      aiProvider: undefined,
      aiModel: undefined,
      outputPath: "/tmp/proassist/output/new_template/",
      outputFileNamePrefix: "new_template_slide_",
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
    console.log("Added template:", newTemplate);
  };

  const handleDeleteTemplate = (idToDelete: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== idToDelete));
    if (selectedTemplateId === idToDelete) {
      setSelectedTemplateId(
        templates.length > 1
          ? templates.find((t) => t.id !== idToDelete)?.id || null
          : null
      );
    }
    console.log("Deleted template:", idToDelete);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Style objects using CSS variables (similar to MainApplicationPage)
  const pageLayoutStyle: React.CSSProperties = {
    display: "flex",
    height: "calc(100vh - 51px)", // Assuming nav is 50px + 1px border
    backgroundColor: "var(--app-bg-color)",
  };

  const leftColumnStyle: React.CSSProperties = {
    width: "300px",
    borderRight: "1px solid var(--app-border-color)",
    overflowY: "auto",
    padding: "20px",
    backgroundColor: "var(--app-header-bg)", // Slightly different bg for clarity
  };

  const rightColumnStyle: React.CSSProperties = {
    flexGrow: 1,
    padding: "20px",
    overflowY: "auto",
  };

  return (
    <div style={pageLayoutStyle}>
      <div style={leftColumnStyle}>
        <div className="settings-nav-pane">
          <button
            onClick={() => setCurrentView("templates")}
            className={currentView === "templates" ? "active" : ""}
            style={{ marginRight: "10px", marginBottom: "10px" }}
          >
            Manage Templates
          </button>
          <button
            onClick={() => setCurrentView("aiConfiguration")}
            className={currentView === "aiConfiguration" ? "active" : ""}
            style={{ marginBottom: "10px" }}
          >
            AI Configuration
          </button>
        </div>
        {currentView === "templates" && (
          <SettingsList
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
            onAddTemplate={handleAddTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}
      </div>
      <div style={rightColumnStyle}>
        {currentView === "templates" && selectedTemplate && (
          <SettingsDetail
            key={selectedTemplate.id}
            template={selectedTemplate}
            onSave={handleSaveTemplate}
          />
        )}
        {currentView === "templates" && !selectedTemplate && (
          <p
            style={{
              color: "var(--app-text-color-secondary)",
              textAlign: "center",
              paddingTop: "30px",
            }}
          >
            Select a template to view or edit its details, or add a new one.
          </p>
        )}
        {currentView === "aiConfiguration" && <AISettingsForm />}
      </div>
    </div>
  );
};

export default SettingsPage;
