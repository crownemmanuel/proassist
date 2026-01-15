/**
 * ProPresenter AI Templates Settings Component
 * 
 * Allows users to configure templates for the AI assistant to display
 * content directly on ProPresenter by writing to files and triggering slides.
 */

import React, { useState, useEffect } from "react";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import {
  ProPresenterAITemplate,
  ProPresenterAITemplateUseCase,
} from "../types/globalChat";
import {
  loadProPresenterAITemplates,
  saveProPresenterAITemplates,
  USE_CASE_LABELS,
} from "../utils/proPresenterAITemplates";
import { useDebouncedEffect } from "../hooks/useDebouncedEffect";

interface ProPresenterAITemplatesSettingsProps {
  onTemplatesChange?: (templates: ProPresenterAITemplate[]) => void;
}

const ProPresenterAITemplatesSettings: React.FC<ProPresenterAITemplatesSettingsProps> = ({
  onTemplatesChange,
}) => {
  const [templates, setTemplates] = useState<ProPresenterAITemplate[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProPresenterAITemplate>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<ProPresenterAITemplate | null>(null);

  // Load templates on mount
  useEffect(() => {
    setTemplates(loadProPresenterAITemplates());
    setSettingsLoaded(true);
  }, []);

  // Save templates and notify parent
  const saveTemplates = (newTemplates: ProPresenterAITemplate[]) => {
    setTemplates(newTemplates);
    saveProPresenterAITemplates(newTemplates);
    onTemplatesChange?.(newTemplates);
  };

  const isValidTemplateDraft = (form: Partial<ProPresenterAITemplate>) => {
    return !!(
      form.name &&
      form.outputPath &&
      form.outputFileNamePrefix &&
      form.presentationUuid
    );
  };

  // Auto-save the current draft on change (debounced). We only persist when the
  // draft is "valid enough" to avoid breaking downstream consumers.
  useDebouncedEffect(
    () => {
      if (!settingsLoaded) return;
      if (!isAdding && !isEditing) return;
      if (!draftId) return;

      if (!isValidTemplateDraft(editForm)) {
        setStatusMessage("Fill required fields to save");
        return;
      }

      const normalized: ProPresenterAITemplate = {
        id: draftId,
        name: editForm.name!,
        description: editForm.description || "",
        useCase: (editForm.useCase as ProPresenterAITemplateUseCase) || "custom",
        maxLines: editForm.maxLines || 3,
        outputPath: editForm.outputPath!,
        outputFileNamePrefix: editForm.outputFileNamePrefix!,
        presentationUuid: editForm.presentationUuid!,
        slideIndex: editForm.slideIndex || 0,
        activationClicks: editForm.activationClicks || 1,
      };

      const exists = templates.some((t) => t.id === draftId);
      const updated = exists
        ? templates.map((t) => (t.id === draftId ? normalized : t))
        : [...templates, normalized];

      saveTemplates(updated);
      setStatusMessage("All changes saved");
      setTimeout(() => setStatusMessage(null), 2000);
    },
    [editForm, isAdding, isEditing, draftId, templates, settingsLoaded],
    { delayMs: 600, enabled: settingsLoaded, skipFirstRun: true }
  );

  // Start editing a template
  const startEditing = (template: ProPresenterAITemplate) => {
    setEditForm({ ...template });
    setIsEditing(template.id);
    setIsAdding(false);
    setDraftId(template.id);
    setOriginalTemplate(template);
    setStatusMessage(null);
  };

  // Start adding a new template
  const startAdding = () => {
    const newId = `pp-ai-tpl-${Date.now()}`;
    setEditForm({
      name: "",
      description: "",
      useCase: "custom",
      maxLines: 3,
      outputPath: "",
      outputFileNamePrefix: "",
      presentationUuid: "",
      slideIndex: 0,
      activationClicks: 1,
    });
    setIsAdding(true);
    setIsEditing(null);
    setDraftId(newId);
    setOriginalTemplate(null);
    setStatusMessage("Fill required fields to save");
  };

  const doneEditing = () => {
    if (!isValidTemplateDraft(editForm)) {
      setStatusMessage("Fill required fields to save");
      return;
    }
    setIsEditing(null);
    setIsAdding(false);
    setEditForm({});
    setDraftId(null);
    setOriginalTemplate(null);
  };

  // Discard changes (reverts to original for edits, or drops the draft for adds)
  const discardEditing = () => {
    if (originalTemplate && draftId) {
      // revert persisted changes (best-effort)
      saveTemplates(templates.map((t) => (t.id === draftId ? originalTemplate : t)));
    }
    setIsEditing(null);
    setIsAdding(false);
    setEditForm({});
    setDraftId(null);
    setOriginalTemplate(null);
    setStatusMessage(null);
  };

  // Delete a template
  const deleteTemplate = (id: string) => {
    if (window.confirm("Are you sure you want to delete this AI template?")) {
      saveTemplates(templates.filter((t) => t.id !== id));
    }
  };

  // Browse for folder (Tauri only)
  const browseForFolder = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI__) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          directory: true,
        });
        if (selected) {
          setEditForm((prev) => ({ ...prev, outputPath: selected as string }));
        }
      } else {
        // Manual input fallback
        const path = prompt("Enter the output folder path:");
        if (path) {
          setEditForm((prev) => ({ ...prev, outputPath: path }));
        }
      }
    } catch (error) {
      console.error("Error browsing for folder:", error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Template Button */}
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "var(--spacing-3)" }}>
        <button
          onClick={startAdding}
          disabled={isAdding || isEditing !== null}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white text-sm rounded-lg transition-colors"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            backgroundColor: isAdding || isEditing !== null ? "rgba(139, 92, 246, 0.5)" : "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isAdding || isEditing !== null ? "not-allowed" : "pointer",
          }}
        >
          <PlusIcon className="w-4 h-4" style={{ width: "16px", height: "16px" }} />
          Add Template
        </button>
      </div>

      {/* Templates list */}
      <div className="space-y-3">
        {templates.length === 0 && !isAdding && (
          <div style={{
            padding: "24px",
            border: "1px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.5)",
          }}>
            No templates configured. Add one to enable AI to display directly on ProPresenter.
          </div>
        )}

        {templates.map((template) => (
          <div
            key={template.id}
            className="p-4 bg-white/5 border border-white/10 rounded-lg"
          >
            {isEditing === template.id ? (
              <TemplateForm
                form={editForm}
                setForm={setEditForm}
                onDone={doneEditing}
                onDiscard={discardEditing}
                onBrowseFolder={browseForFolder}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{template.name}</span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                      {USE_CASE_LABELS[template.useCase]}
                    </span>
                    <span className="text-white/40 text-xs">
                      {template.maxLines} lines
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-2">{template.description}</p>
                  <div className="text-xs text-white/40 space-y-0.5">
                    <div>Output: {template.outputPath}{template.outputFileNamePrefix}[1-{template.maxLines}].txt</div>
                    <div>Presentation: {template.presentationUuid} (slide {template.slideIndex})</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditing(template)}
                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new template form */}
        {isAdding && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <TemplateForm
              form={editForm}
              setForm={setEditForm}
              onDone={doneEditing}
              onDiscard={discardEditing}
              onBrowseFolder={browseForFolder}
              isNew
            />
          </div>
        )}
      </div>

      {/* Auto-save status */}
      {statusMessage && (
        <div style={{ marginTop: "var(--spacing-3)", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

/**
 * Template edit form component
 */
interface TemplateFormProps {
  form: Partial<ProPresenterAITemplate>;
  setForm: React.Dispatch<React.SetStateAction<Partial<ProPresenterAITemplate>>>;
  onDone: () => void;
  onDiscard: () => void;
  onBrowseFolder: () => void;
  isNew?: boolean;
}

const TemplateForm: React.FC<TemplateFormProps> = ({
  form,
  setForm,
  onDone,
  onDiscard,
  onBrowseFolder,
  isNew,
}) => {
  const useCases: ProPresenterAITemplateUseCase[] = [
    "lower-third",
    "prayer",
    "scripture",
    "announcement",
    "points-3line",
    "points-6line",
    "custom",
  ];

  return (
    <div className="space-y-3">
      {isNew && (
        <h4 className="font-medium text-white mb-2">New AI Template</h4>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="block text-white/60 text-xs mb-1">Name *</label>
          <input
            type="text"
            value={form.name || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Lower Third"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Use Case */}
        <div>
          <label className="block text-white/60 text-xs mb-1">Use Case</label>
          <select
            value={form.useCase || "custom"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                useCase: e.target.value as ProPresenterAITemplateUseCase,
              }))
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {useCases.map((uc) => (
              <option key={uc} value={uc} className="bg-slate-800">
                {USE_CASE_LABELS[uc]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-white/60 text-xs mb-1">Description (AI uses this to select)</label>
        <input
          type="text"
          value={form.description || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="e.g., Good for name titles and speaker introductions"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Max Lines */}
        <div>
          <label className="block text-white/60 text-xs mb-1">Max Lines</label>
          <input
            type="number"
            min={1}
            max={10}
            value={form.maxLines || 3}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, maxLines: parseInt(e.target.value) || 3 }))
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Slide Index */}
        <div>
          <label className="block text-white/60 text-xs mb-1">Slide Index</label>
          <input
            type="number"
            min={0}
            value={form.slideIndex || 0}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, slideIndex: parseInt(e.target.value) || 0 }))
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Go Live Clicks */}
        <div>
          <label className="block text-white/60 text-xs mb-1">Go Live Clicks</label>
          <input
            type="number"
            min={1}
            max={10}
            value={form.activationClicks || 1}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, activationClicks: parseInt(e.target.value) || 1 }))
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <p className="text-white/40 text-xs mt-1">For animations</p>
        </div>
      </div>

      {/* Output Folder Path */}
      <div>
        <label className="block text-white/60 text-xs mb-1">Output Folder Path *</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.outputPath || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, outputPath: e.target.value }))}
            placeholder="/path/to/output/folder/"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={onBrowseFolder}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Browse for folder"
          >
            <FolderOpenIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/40 text-xs mt-1">Folder where files are written (e.g., /Users/you/ProPresenter/live/)</p>
      </div>

      {/* File Name Prefix */}
      <div>
        <label className="block text-white/60 text-xs mb-1">File Name Prefix *</label>
        <input
          type="text"
          value={form.outputFileNamePrefix || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, outputFileNamePrefix: e.target.value }))}
          placeholder="verse_"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <p className="text-white/40 text-xs mt-1">Creates files: {form.outputFileNamePrefix || "prefix_"}1.txt, {form.outputFileNamePrefix || "prefix_"}2.txt, etc.</p>
      </div>

      {/* Presentation UUID */}
      <div>
        <label className="block text-white/60 text-xs mb-1">Presentation UUID *</label>
        <input
          type="text"
          value={form.presentationUuid || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, presentationUuid: e.target.value }))}
          placeholder="Get this from ProPresenter"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
          {isNew ? "Discard" : "Discard Changes"}
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
        >
          <CheckIcon className="w-4 h-4" />
          Done
        </button>
      </div>
    </div>
  );
};

export default ProPresenterAITemplatesSettings;
