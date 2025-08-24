import React, { useState, useEffect, useRef } from "react";
import SettingsDetail from "../components/SettingsDetail";
import { Template } from "../types";
import AISettingsForm from "../components/AISettingsForm";
import { FaList, FaRobot } from "react-icons/fa";
import "../App.css"; // Ensure global styles are applied
import {
  exportAllTemplatesToFile,
  parseTemplatesFromJsonFile,
  generateTemplateId,
} from "../utils/templateIO";
import TemplateListView from "../components/TemplateListView";
import ConfirmDialog from "../components/ConfirmDialog";

type SettingsView = "templates" | "aiConfiguration";

const SettingsPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>(() => {
    const savedTemplates = localStorage.getItem("proassist-templates");
    return savedTemplates ? JSON.parse(savedTemplates) : [];
  });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null
  );
  const [currentView, setCurrentView] = useState<SettingsView>("templates");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem("proassist-templates", JSON.stringify(templates));
  }, [templates]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const handleSaveTemplate = (updatedTemplate: Template) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );
    setToastType("success");
    setToastMessage("Template saved");
    setEditingTemplateId(null); // Return to list view
    console.log("Saved template:", updatedTemplate);
  };

  const handleAddTemplate = () => {
    const newTemplate: Template = {
      id: `tpl-${Date.now()}`,
      name: "New Template",
      type: "text",
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      icon: "file-text",
      processingType: "simple",
      logic: "line-break",
      availableLayouts: ["one-line", "two-line"],
      aiPrompt: "",
      aiProvider: undefined,
      aiModel: undefined,
      outputPath: "/tmp/proassist/output/new_template/",
      outputFileNamePrefix: "new_template_slide_",
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setEditingTemplateId(newTemplate.id);
    setToastType("success");
    setToastMessage(`Template "${newTemplate.name}" added`);
    console.log("Added template:", newTemplate);
  };

  const handleDeleteTemplate = (idToDelete: string) => {
    setDeletingTemplateId(idToDelete);
  };

  const confirmDeleteTemplate = () => {
    if (!deletingTemplateId) return;
    const deleted = templates.find((t) => t.id === deletingTemplateId);
    setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplateId));
    if (editingTemplateId === deletingTemplateId) {
      setEditingTemplateId(null);
    }
    setSelectedTemplateIds((prev) =>
      prev.filter((id) => id !== deletingTemplateId)
    );
    setToastType("info");
    setToastMessage(`Template ${deleted ? `\"${deleted.name}\" ` : ""}deleted`);
    console.log("Deleted template:", deletingTemplateId);
    setDeletingTemplateId(null);
  };

  const handleClickImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await parseTemplatesFromJsonFile(file);
      setTemplates((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const existingNames = new Set(prev.map((t) => t.name.toLowerCase()));
        const merged: Template[] = [...prev];
        for (const tpl of imported) {
          let newTemplate = { ...tpl } as Template;
          if (!newTemplate.id || existingIds.has(newTemplate.id)) {
            newTemplate.id = generateTemplateId();
          }
          if (existingNames.has(newTemplate.name.toLowerCase())) {
            const base = newTemplate.name.replace(
              / \(Imported(?: \d+)?\)$/i,
              ""
            );
            let candidate = `${base} (Imported)`;
            let counter = 2;
            while (
              merged.some(
                (x) => x.name.toLowerCase() === candidate.toLowerCase()
              )
            ) {
              candidate = `${base} (Imported ${counter})`;
              counter++;
            }
            newTemplate.name = candidate;
          }
          merged.push(newTemplate);
          existingIds.add(newTemplate.id);
          existingNames.add(newTemplate.name.toLowerCase());
        }
        return merged;
      });
      setToastType("success");
      setToastMessage(
        `Imported ${imported.length} template${imported.length > 1 ? "s" : ""}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastType("error");
      setToastMessage(`Import failed: ${msg}`);
    } finally {
      // reset input so selecting the same file again will trigger onChange
      if (e.target) e.target.value = "";
    }
  };

  const selectedTemplate = templates.find((t) => t.id === editingTemplateId);

  // Style objects using CSS variables (similar to MainApplicationPage)
  const pageLayoutStyle: React.CSSProperties = {
    display: "flex",
    height: "calc(100vh - 51px)", // Assuming nav is 50px + 1px border
    backgroundColor: "var(--app-bg-color)",
  };

  const leftColumnStyle: React.CSSProperties = {
    width: "260px",
    borderRight: "1px solid var(--app-border-color)",
    overflowY: "auto",
    padding: 0,
    backgroundColor: "#1e1e1e",
    display: "flex",
    flexDirection: "column",
  };

  const rightColumnStyle: React.CSSProperties = {
    flexGrow: 1,
    padding: "var(--spacing-5)",
    overflowY: "auto",
    backgroundColor: "var(--app-bg-color)",
  };

  return (
    <div style={pageLayoutStyle}>
      <div style={leftColumnStyle}>
        <div className="settings-rail-header">Settings</div>
        <div
          className="settings-nav-pane"
          style={{ padding: "var(--spacing-2)" }}
        >
          <button
            onClick={() => setCurrentView("templates")}
            className={currentView === "templates" ? "active" : ""}
          >
            <FaList />
            Manage Templates
          </button>
          <button
            onClick={() => setCurrentView("aiConfiguration")}
            className={currentView === "aiConfiguration" ? "active" : ""}
          >
            <FaRobot />
            AI Configuration
          </button>
        </div>
      </div>
      <div style={rightColumnStyle}>
        {currentView === "templates" && (
          <>
            {selectedTemplate ? (
              <SettingsDetail
                key={selectedTemplate.id}
                template={selectedTemplate}
                onSave={handleSaveTemplate}
                onBack={() => setEditingTemplateId(null)}
              />
            ) : (
              <TemplateListView
                templates={templates}
                selectedTemplates={selectedTemplateIds}
                onSelectTemplate={handleSelectTemplate}
                onEditTemplate={setEditingTemplateId}
                onAddTemplate={handleAddTemplate}
                onImport={handleClickImport}
                onExportAll={async () => {
                  const result = await exportAllTemplatesToFile(templates);
                  if (result.status === "saved") {
                    setToastType("success");
                    setToastMessage("Templates exported");
                  } else if (result.status === "fallback") {
                    setToastType("success");
                    setToastMessage("Templates downloaded");
                  }
                }}
                onExportSelected={async () => {
                  if (selectedTemplateIds.length === 0) return;
                  const toExport = templates.filter((t) =>
                    selectedTemplateIds.includes(t.id)
                  );
                  const result = await exportAllTemplatesToFile(toExport);
                  if (result.status === "saved") {
                    setToastType("success");
                    setToastMessage("Templates exported");
                  } else if (result.status === "fallback") {
                    setToastType("success");
                    setToastMessage("Templates downloaded");
                  }
                }}
                hasSelection={selectedTemplateIds.length > 0}
                onDeleteTemplate={handleDeleteTemplate}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              style={{ display: "none" }}
            />
          </>
        )}
        {currentView === "aiConfiguration" && <AISettingsForm />}
      </div>
      {deletingTemplateId && (
        <ConfirmDialog
          isOpen={!!deletingTemplateId}
          title="Delete Template"
          message={`Are you sure you want to delete the template "${
            templates.find((t) => t.id === deletingTemplateId)?.name
          }"?`}
          onConfirm={confirmDeleteTemplate}
          onCancel={() => setDeletingTemplateId(null)}
        />
      )}
      {toastMessage && (
        <div
          className={`toast toast-${toastType}`}
          onClick={() => setToastMessage("")}
          title="Click to dismiss"
        >
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
