import React, { useState, useEffect } from "react";
import { FaDesktop, FaCheck, FaTimes, FaSpinner, FaMagic, FaSave } from "react-icons/fa";
import {
  getEnabledConnections,
  getCurrentSlideIndex,
} from "../services/propresenterService";
import { ScheduleItemAutomation, SmartAutomationRule } from "../types/propresenter";
import {
  loadSmartAutomations,
  addSmartAutomation,
  removeSmartAutomation,
} from "../utils/testimoniesStorage";
import "../App.css";

interface ScheduleAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (automation: ScheduleItemAutomation | undefined) => void;
  currentAutomation?: ScheduleItemAutomation;
  sessionName: string;
}

const ScheduleAutomationModal: React.FC<ScheduleAutomationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAutomation,
  sessionName,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedAutomation, setSavedAutomation] = useState<ScheduleItemAutomation | null>(
    currentAutomation || null
  );
  const [activationClicks, setActivationClicks] = useState<number>(
    currentAutomation?.activationClicks ?? 1
  );
  
  // Smart automation options
  const [saveAsSmartRule, setSaveAsSmartRule] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(true);
  const [smartRules, setSmartRules] = useState<SmartAutomationRule[]>([]);
  const [matchingRule, setMatchingRule] = useState<SmartAutomationRule | null>(null);

  // Load smart rules and check for matches
  useEffect(() => {
    const rules = loadSmartAutomations();
    setSmartRules(rules);
    
    // Check if there's a matching rule for this session
    const normalizedName = sessionName.toLowerCase().trim();
    const exactMatch = rules.find(
      (r) => r.isExactMatch && r.sessionNamePattern.toLowerCase().trim() === normalizedName
    );
    if (exactMatch) {
      setMatchingRule(exactMatch);
    } else {
      const containsMatch = rules.find(
        (r) => !r.isExactMatch && normalizedName.includes(r.sessionNamePattern.toLowerCase().trim())
      );
      setMatchingRule(containsMatch || null);
    }
  }, [sessionName]);

  // Reset state when modal opens
  useEffect(() => {
    setSavedAutomation(currentAutomation || null);
    setActivationClicks(currentAutomation?.activationClicks ?? 1);
    setSuccess(false);
    setError(null);
    setSaveAsSmartRule(false);
  }, [currentAutomation, isOpen]);

  const handleGetSlide = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const enabledConnections = getEnabledConnections();
    if (enabledConnections.length === 0) {
      setError("No enabled ProPresenter connections found. Please enable at least one connection in Settings.");
      setIsLoading(false);
      return;
    }

    // Try each enabled connection until one succeeds
    let lastError: string | null = null;
    for (const connection of enabledConnections) {
      try {
        const slideIndexData = await getCurrentSlideIndex(connection);
        if (slideIndexData?.presentation_index) {
          const automation: ScheduleItemAutomation = {
            presentationUuid: slideIndexData.presentation_index.presentation_id.uuid,
            slideIndex: slideIndexData.presentation_index.index,
            presentationName: slideIndexData.presentation_index.presentation_id.name,
            activationClicks: activationClicks !== 1 ? activationClicks : undefined,
          };
          setSavedAutomation(automation);
          setSuccess(true);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to get slide index";
      }
    }

    setError(
      lastError ||
        "Failed to get slide index from any ProPresenter connection. Make sure ProPresenter is running and the slide is live."
    );
    setIsLoading(false);
  };

  const handleSave = () => {
    if (savedAutomation) {
      const automationToSave: ScheduleItemAutomation = {
        ...savedAutomation,
        activationClicks: activationClicks !== 1 ? activationClicks : undefined,
      };
      
      // Save as smart rule if checked
      if (saveAsSmartRule) {
        const rule: SmartAutomationRule = {
          id: `rule-${Date.now()}`,
          sessionNamePattern: sessionName,
          isExactMatch: isExactMatch,
          automation: automationToSave,
          createdAt: Date.now(),
        };
        addSmartAutomation(rule);
      }
      
      onSave(automationToSave);
    } else {
      onSave(undefined);
    }
    onClose();
  };

  const handleRemove = () => {
    onSave(undefined);
    onClose();
  };
  
  const handleApplyMatchingRule = () => {
    if (matchingRule) {
      setSavedAutomation(matchingRule.automation);
      setActivationClicks(matchingRule.automation.activationClicks ?? 1);
      setSuccess(true);
    }
  };

  const handleRemoveSmartRule = (ruleId: string) => {
    removeSmartAutomation(ruleId);
    setSmartRules(loadSmartAutomations());
    if (matchingRule?.id === ruleId) {
      setMatchingRule(null);
    }
  };

  const handleCancel = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setSavedAutomation(currentAutomation || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "550px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FaMagic />
          Schedule Automation
        </h2>
        
        <div style={{ marginBottom: "16px", color: "var(--app-text-color-secondary)", fontSize: "0.9em" }}>
          Session: <strong style={{ color: "var(--app-text-color)" }}>{sessionName}</strong>
        </div>

        {/* Matching Smart Rule Notification */}
        {matchingRule && !currentAutomation && (
          <div
            style={{
              marginBottom: "12px",
              padding: "12px",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "6px",
              color: "#3b82f6",
              fontSize: "0.9em",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  <FaMagic style={{ marginRight: "6px" }} />
                  Matching Smart Rule Found
                </div>
                <div style={{ fontSize: "0.85em", opacity: 0.9 }}>
                  Pattern: "{matchingRule.sessionNamePattern}" ({matchingRule.isExactMatch ? "exact" : "contains"})
                  <br />
                  Slide: {matchingRule.automation.presentationName || matchingRule.automation.presentationUuid}
                </div>
              </div>
              <button
                onClick={handleApplyMatchingRule}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85em",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            backgroundColor: "var(--app-header-bg)",
            borderRadius: "8px",
            border: "1px solid var(--app-border-color)",
          }}
        >
          <p style={{ margin: "0 0 12px 0", color: "var(--app-text-color)" }}>
            <strong>Instructions:</strong>
          </p>
          <ol
            style={{
              margin: "0",
              paddingLeft: "20px",
              color: "var(--app-text-color-secondary)",
            }}
          >
            <li>Go to ProPresenter and put the slide you want to trigger live</li>
            <li>Click "Get Slide" below to capture the current slide</li>
            <li>Optionally save as a smart rule to auto-apply to future sessions</li>
          </ol>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: "6px",
              color: "#ef4444",
              fontSize: "0.9em",
            }}
          >
            {error}
          </div>
        )}

        {success && savedAutomation && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "6px",
              color: "#22c55e",
              fontSize: "0.9em",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCheck />
              <div>
                <div style={{ fontWeight: 600 }}>Slide captured!</div>
                <div style={{ fontSize: "0.85em", marginTop: "4px", opacity: 0.9 }}>
                  Presentation: {savedAutomation.presentationName || savedAutomation.presentationUuid}
                  <br />
                  Slide Index: {savedAutomation.slideIndex}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentAutomation && !success && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
              fontSize: "0.9em",
              color: "var(--app-text-color-secondary)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>Current Automation:</div>
            <div>
              Presentation: {currentAutomation.presentationName || currentAutomation.presentationUuid}
              <br />
              Slide Index: {currentAutomation.slideIndex}
            </div>
          </div>
        )}

        {/* Clicks Setting */}
        {savedAutomation && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "0.85em", display: "block", marginBottom: "4px", color: "var(--app-text-color-secondary)" }}>
                Trigger Clicks (for animations):
              </label>
              <input
                type="number"
                min="1"
                value={activationClicks}
                onChange={(e) => setActivationClicks(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: "80px",
                  padding: "4px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                }}
              />
            </div>
            
            {/* Smart Rule Option */}
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--app-border-color)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9em" }}>
                <input
                  type="checkbox"
                  checked={saveAsSmartRule}
                  onChange={(e) => setSaveAsSmartRule(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                <FaSave style={{ color: "var(--app-primary-color)" }} />
                <span>Save as smart rule (auto-apply to future "{sessionName}" sessions)</span>
              </label>
              
              {saveAsSmartRule && (
                <div style={{ marginTop: "8px", marginLeft: "28px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
                    <input
                      type="radio"
                      name="matchType"
                      checked={isExactMatch}
                      onChange={() => setIsExactMatch(true)}
                    />
                    <span>Exact name match</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85em", color: "var(--app-text-color-secondary)", marginTop: "4px" }}>
                    <input
                      type="radio"
                      name="matchType"
                      checked={!isExactMatch}
                      onChange={() => setIsExactMatch(false)}
                    />
                    <span>Contains (matches sessions containing "{sessionName}")</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Smart Rules */}
        {smartRules.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.85em", fontWeight: 600, marginBottom: "8px", color: "var(--app-text-color)" }}>
              Saved Smart Rules:
            </div>
            <div style={{ maxHeight: "120px", overflowY: "auto" }}>
              {smartRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    marginBottom: "4px",
                    backgroundColor: "var(--app-input-bg-color)",
                    borderRadius: "4px",
                    fontSize: "0.85em",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--app-text-color)" }}>"{rule.sessionNamePattern}"</span>
                    <span style={{ color: "var(--app-text-color-secondary)", marginLeft: "6px" }}>
                      ({rule.isExactMatch ? "exact" : "contains"})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSmartRule(rule.id)}
                    style={{
                      padding: "2px 6px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "0.85em",
                    }}
                    title="Remove this rule"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          {currentAutomation && (
            <button onClick={handleRemove} className="secondary" style={{ marginRight: "auto" }}>
              <FaTimes />
              Remove
            </button>
          )}
          <button onClick={handleCancel} className="secondary">
            <FaTimes />
            Cancel
          </button>
          <button
            onClick={handleGetSlide}
            disabled={isLoading}
            className="secondary"
            style={{ minWidth: "140px" }}
          >
            {isLoading ? (
              <>
                <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                Reading...
              </>
            ) : (
              <>
                <FaDesktop />
                Get Slide
              </>
            )}
          </button>
          {savedAutomation && (
            <button onClick={handleSave} className="primary">
              <FaCheck />
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleAutomationModal;
