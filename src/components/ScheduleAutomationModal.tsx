import React, { useState, useEffect } from "react";
import {
  FaDesktop,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaMagic,
  FaSave,
  FaLayerGroup,
} from "react-icons/fa";
import {
  getEnabledConnections,
  getCurrentSlideIndex,
  getStageScreens,
  getStageLayouts,
} from "../services/propresenterService";
import {
  ScheduleItemAutomation,
  SmartAutomationRule,
  ProPresenterStageScreen,
  ProPresenterStageLayout,
  ProPresenterConnection,
} from "../types/propresenter";
import {
  loadSmartAutomations,
  addSmartAutomation,
  removeSmartAutomation,
} from "../utils/testimoniesStorage";
import "../App.css";

interface ScheduleAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (automations: ScheduleItemAutomation[] | undefined) => void;
  currentAutomations?: ScheduleItemAutomation[];
  sessionName: string;
}

type AutomationType = "slide" | "stageLayout";

const ScheduleAutomationModal: React.FC<ScheduleAutomationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAutomations,
  sessionName,
}) => {
  const [automationType, setAutomationType] = useState<AutomationType>("slide");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedAutomations, setSavedAutomations] = useState<
    ScheduleItemAutomation[]
  >(currentAutomations || []);
  const [activationClicks, setActivationClicks] = useState<number>(1);

  // Stage layout state
  const [stageScreens, setStageScreens] = useState<ProPresenterStageScreen[]>(
    []
  );
  const [stageLayouts, setStageLayouts] = useState<ProPresenterStageLayout[]>(
    []
  );
  const [selectedScreenIndex, setSelectedScreenIndex] = useState<number | null>(
    null
  );
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState<number | null>(
    null
  );
  const [isLoadingStageData, setIsLoadingStageData] = useState(false);

  // Smart automation options
  const [saveAsSmartRule, setSaveAsSmartRule] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(true);
  const [smartRules, setSmartRules] = useState<SmartAutomationRule[]>([]);
  const [matchingRule, setMatchingRule] = useState<SmartAutomationRule | null>(
    null
  );

  // ProPresenter connection selection
  const [enabledConnections, setEnabledConnections] = useState<ProPresenterConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  // Track if modal was just opened to prevent re-initialization
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load smart rules and check for matches
  useEffect(() => {
    const rules = loadSmartAutomations();
    setSmartRules(rules);

    // Check if there's a matching rule for this session
    const normalizedName = sessionName.toLowerCase().trim();
    const exactMatch = rules.find(
      (r) =>
        r.isExactMatch &&
        r.sessionNamePattern.toLowerCase().trim() === normalizedName
    );
    if (exactMatch) {
      setMatchingRule(exactMatch);
    } else {
      const containsMatch = rules.find(
        (r) =>
          !r.isExactMatch &&
          normalizedName.includes(r.sessionNamePattern.toLowerCase().trim())
      );
      setMatchingRule(containsMatch || null);
    }
  }, [sessionName]);

  // Load stage screens and layouts when type is stageLayout
  useEffect(() => {
    if (automationType === "stageLayout" && isOpen) {
      loadStageData();
    }
  }, [automationType, isOpen]);

  // Load enabled connections when modal opens
  useEffect(() => {
    if (isOpen) {
      const connections = getEnabledConnections();
      setEnabledConnections(connections);
      // Auto-select first connection if available
      if (connections.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(connections[0].id);
      }
    }
  }, [isOpen]);

  // Reset state when modal opens - only on initial open, not on every currentAutomations change
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      const initialAutomations = currentAutomations || [];
      setSavedAutomations(initialAutomations);

      // default to slide tab unless only stageLayout exists
      const hasSlide = initialAutomations.some((a) => a.type === "slide");
      const hasStage = initialAutomations.some((a) => a.type === "stageLayout");
      const initialType: AutomationType = hasSlide
        ? "slide"
        : hasStage
        ? "stageLayout"
        : "slide";
      setAutomationType(initialType);

      const existingSlide = initialAutomations.find((a) => a.type === "slide");
      setActivationClicks(
        existingSlide?.type === "slide"
          ? existingSlide.activationClicks ?? 1
          : 1
      );

      const existingStage = initialAutomations.find(
        (a) => a.type === "stageLayout"
      );
      if (existingStage?.type === "stageLayout") {
        setSelectedScreenIndex(existingStage.screenIndex);
        setSelectedLayoutIndex(existingStage.layoutIndex);
      } else {
        setSelectedScreenIndex(null);
        setSelectedLayoutIndex(null);
      }

      setSuccess(false);
      setError(null);
      setSaveAsSmartRule(false);
      setHasInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when modal closes
      setHasInitialized(false);
    }
  }, [isOpen, hasInitialized, currentAutomations]);

  const loadStageData = async () => {
    setIsLoadingStageData(true);
    setError(null);

    const connections = enabledConnections.length > 0 ? enabledConnections : getEnabledConnections();
    if (connections.length === 0) {
      setError(
        "No enabled ProPresenter connections found. Please enable at least one connection in Settings."
      );
      setIsLoadingStageData(false);
      return;
    }

    // Use the selected connection
    const connection = connections.find(c => c.id === selectedConnectionId) || connections[0];

    try {
      const [screens, layouts] = await Promise.all([
        getStageScreens(connection),
        getStageLayouts(connection),
      ]);

      if (screens.length > 0 && layouts.length > 0) {
        setStageScreens(screens);
        setStageLayouts(layouts);
        setIsLoadingStageData(false);
        return;
      } else {
        setError("No stage screens or layouts found in ProPresenter.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stage data");
    }

    setIsLoadingStageData(false);
  };

  const handleGetSlide = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    if (enabledConnections.length === 0) {
      setError(
        "No enabled ProPresenter connections found. Please enable at least one connection in Settings."
      );
      setIsLoading(false);
      return;
    }

    // Find the selected connection
    const connection = enabledConnections.find(c => c.id === selectedConnectionId) || enabledConnections[0];

    try {
      const slideIndexData = await getCurrentSlideIndex(connection);
      if (slideIndexData?.presentation_index) {
        const automation: ScheduleItemAutomation = {
          type: "slide",
          presentationUuid:
            slideIndexData.presentation_index.presentation_id.uuid,
          slideIndex: slideIndexData.presentation_index.index,
          presentationName:
            slideIndexData.presentation_index.presentation_id.name,
          activationClicks:
            activationClicks !== 1 ? activationClicks : undefined,
        };
        setSavedAutomations((prev) => {
          const others = prev.filter((a) => a.type !== "slide");
          return [...others, automation];
        });
        setSuccess(true);
        setIsLoading(false);
        return;
      } else {
        setError("No active presentation found. Make sure a slide is live in ProPresenter.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get slide index");
    }

    setIsLoading(false);
  };

  const handleStageLayoutChange = () => {
    if (selectedScreenIndex === null || selectedLayoutIndex === null) {
      setError("Please select both a screen and a layout");
      return;
    }

    const screen = stageScreens.find((s) => s.index === selectedScreenIndex);
    const layout = stageLayouts.find((l) => l.id.index === selectedLayoutIndex);

    if (!screen || !layout) {
      setError("Invalid screen or layout selection");
      return;
    }

    const automation: ScheduleItemAutomation = {
      type: "stageLayout",
      screenUuid: screen.uuid,
      screenName: screen.name,
      screenIndex: screen.index,
      layoutUuid: layout.id.uuid,
      layoutName: layout.id.name,
      layoutIndex: layout.id.index,
    };

    setSavedAutomations((prev) => {
      const others = prev.filter((a) => a.type !== "stageLayout");
      return [...others, automation];
    });
    setSuccess(true);
    setError(null);
  };

  const handleSave = () => {
    if (savedAutomations.length > 0) {
      const automationToSave: ScheduleItemAutomation[] = savedAutomations.map(
        (a) => {
          if (a.type !== "slide") return a;
          return {
            ...a,
            activationClicks:
              activationClicks !== 1 ? activationClicks : undefined,
          };
        }
      );

      // Save as smart rule if checked
      if (saveAsSmartRule) {
        const rule: SmartAutomationRule = {
          id: `rule-${Date.now()}`,
          sessionNamePattern: sessionName,
          isExactMatch: isExactMatch,
          automations: automationToSave,
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

  const handleRemoveCurrentType = () => {
    setSavedAutomations((prev) =>
      prev.filter((a) => a.type !== automationType)
    );
    setSuccess(false);
  };

  const handleApplyMatchingRule = () => {
    if (matchingRule) {
      const ruleAutomations = matchingRule.automations || [];
      setSavedAutomations(ruleAutomations);

      const ruleSlide = ruleAutomations.find((a) => a.type === "slide");
      setActivationClicks(
        ruleSlide?.type === "slide" ? ruleSlide.activationClicks ?? 1 : 1
      );

      const ruleStage = ruleAutomations.find((a) => a.type === "stageLayout");
      if (ruleStage?.type === "stageLayout") {
        setSelectedScreenIndex(ruleStage.screenIndex);
        setSelectedLayoutIndex(ruleStage.layoutIndex);
      }

      // keep current selected tab, but if it has nothing, switch to something that exists
      const hasSelectedType = ruleAutomations.some(
        (a) => a.type === automationType
      );
      if (!hasSelectedType) {
        const nextType: AutomationType = ruleAutomations.some(
          (a) => a.type === "slide"
        )
          ? "slide"
          : "stageLayout";
        setAutomationType(nextType);
      }
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
    setSavedAutomations(currentAutomations || []);
    onClose();
  };

  const handleTypeChange = (type: AutomationType) => {
    setAutomationType(type);
    setSuccess(false);
    setError(null);
    if (type === "stageLayout") {
      loadStageData();
    }
  };

  if (!isOpen) return null;

  const getAutomationTypeLabel = (automation: ScheduleItemAutomation) => {
    if (automation.type === "slide") {
      return `Slide: ${
        automation.presentationName || automation.presentationUuid
      } (Index: ${automation.slideIndex})`;
    } else {
      return `Stage Layout: ${
        automation.screenName || `Screen ${automation.screenIndex}`
      } → ${automation.layoutName || `Layout ${automation.layoutIndex}`}`;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FaMagic />
          Schedule Automation
        </h2>

        <div
          style={{
            marginBottom: "16px",
            color: "var(--app-text-color-secondary)",
            fontSize: "0.9em",
          }}
        >
          Session:{" "}
          <strong style={{ color: "var(--app-text-color)" }}>
            {sessionName}
          </strong>
        </div>

        {/* Automation Type Selector */}
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            backgroundColor: "var(--app-header-bg)",
            borderRadius: "8px",
            border: "1px solid var(--app-border-color)",
          }}
        >
          <label
            style={{
              fontSize: "0.85em",
              display: "block",
              marginBottom: "8px",
              color: "var(--app-text-color-secondary)",
              fontWeight: 600,
            }}
          >
            Automation Type:
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            <label
              style={{
                flex: 1,
                padding: "10px",
                border: `2px solid ${
                  automationType === "slide"
                    ? "var(--app-primary-color)"
                    : "var(--app-border-color)"
                }`,
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor:
                  automationType === "slide"
                    ? "rgba(59, 130, 246, 0.1)"
                    : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9em",
              }}
            >
              <input
                type="radio"
                name="automationType"
                value="slide"
                checked={automationType === "slide"}
                onChange={() => handleTypeChange("slide")}
                style={{ width: "16px", height: "16px" }}
              />
              <FaDesktop />
              <span>Trigger Slide</span>
            </label>
            <label
              style={{
                flex: 1,
                padding: "10px",
                border: `2px solid ${
                  automationType === "stageLayout"
                    ? "var(--app-primary-color)"
                    : "var(--app-border-color)"
                }`,
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor:
                  automationType === "stageLayout"
                    ? "rgba(59, 130, 246, 0.1)"
                    : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9em",
              }}
            >
              <input
                type="radio"
                name="automationType"
                value="stageLayout"
                checked={automationType === "stageLayout"}
                onChange={() => handleTypeChange("stageLayout")}
                style={{ width: "16px", height: "16px" }}
              />
              <FaLayerGroup />
              <span>Change Stage Layout</span>
            </label>
          </div>
        </div>

        {/* Matching Smart Rule Notification */}
        {matchingRule &&
          !(currentAutomations && currentAutomations.length > 0) && (
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                    <FaMagic style={{ marginRight: "6px" }} />
                    Matching Smart Rule Found
                  </div>
                  <div style={{ fontSize: "0.85em", opacity: 0.9 }}>
                    Pattern: "{matchingRule.sessionNamePattern}" (
                    {matchingRule.isExactMatch ? "exact" : "contains"})
                    <br />
                    {(matchingRule.automations || []).length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        {(matchingRule.automations || []).map((a) => (
                          <div key={a.type}>{getAutomationTypeLabel(a)}</div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ opacity: 0.8 }}>No automations</span>
                    )}
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

        {/* Instructions */}
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
          {automationType === "slide" ? (
            <ol
              style={{
                margin: "0",
                paddingLeft: "20px",
                color: "var(--app-text-color-secondary)",
              }}
            >
              <li>
                Go to ProPresenter and put the slide you want to trigger live
              </li>
              <li>Click "Get Slide" below to capture the current slide</li>
              <li>
                Optionally save as a smart rule to auto-apply to future sessions
              </li>
            </ol>
          ) : (
            <ol
              style={{
                margin: "0",
                paddingLeft: "20px",
                color: "var(--app-text-color-secondary)",
              }}
            >
              <li>Select a stage screen from the dropdown</li>
              <li>Select a layout for that screen</li>
              <li>Click "Set Layout" to save the configuration</li>
              <li>
                Optionally save as a smart rule to auto-apply to future sessions
              </li>
            </ol>
          )}
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

        {success && savedAutomations.length > 0 && (
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
                <div style={{ fontWeight: 600 }}>
                  {automationType === "slide"
                    ? "Slide captured!"
                    : "Stage layout configured!"}
                </div>
                <div
                  style={{ fontSize: "0.85em", marginTop: "4px", opacity: 0.9 }}
                >
                  {(() => {
                    const current =
                      automationType === "slide"
                        ? savedAutomations.find((a) => a.type === "slide")
                        : savedAutomations.find(
                            (a) => a.type === "stageLayout"
                          );
                    if (!current) return null;
                    return current.type === "slide" ? (
                      <>
                        Presentation:{" "}
                        {current.presentationName || current.presentationUuid}
                        <br />
                        Slide Index: {current.slideIndex}
                      </>
                    ) : (
                      <>
                        Screen:{" "}
                        {current.screenName || `Screen ${current.screenIndex}`}
                        <br />
                        Layout:{" "}
                        {current.layoutName || `Layout ${current.layoutIndex}`}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentAutomations && currentAutomations.length > 0 && !success && (
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
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              Current Automation:
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {currentAutomations.map((a) => (
                <div key={a.type}>{getAutomationTypeLabel(a)}</div>
              ))}
            </div>
          </div>
        )}

        {/* Slide Configuration */}
        {automationType === "slide" && (
          <>
            {/* Clicks Setting */}
            {savedAutomations.some((a) => a.type === "slide") && (
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
                  <label
                    style={{
                      fontSize: "0.85em",
                      display: "block",
                      marginBottom: "4px",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    Trigger Clicks (for animations):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={activationClicks}
                    onChange={(e) =>
                      setActivationClicks(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
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

                <button
                  onClick={handleRemoveCurrentType}
                  className="secondary"
                  style={{ width: "100%", marginTop: "8px", color: "#ef4444" }}
                >
                  <FaTimes />
                  Remove Slide Automation
                </button>
              </div>
            )}
          </>
        )}

        {/* Stage Layout Configuration */}
        {automationType === "stageLayout" && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  fontSize: "0.85em",
                  display: "block",
                  marginBottom: "4px",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Stage Screen:
              </label>
              <select
                value={selectedScreenIndex ?? ""}
                onChange={(e) => {
                  setSelectedScreenIndex(
                    e.target.value ? parseInt(e.target.value) : null
                  );
                  setSuccess(false);
                }}
                disabled={isLoadingStageData}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                }}
              >
                <option value="">Select a screen...</option>
                {stageScreens.map((screen) => (
                  <option key={screen.uuid} value={screen.index}>
                    {screen.name} (Index: {screen.index})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <label
                style={{
                  fontSize: "0.85em",
                  display: "block",
                  marginBottom: "4px",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Layout:
              </label>
              <select
                value={selectedLayoutIndex ?? ""}
                onChange={(e) => {
                  setSelectedLayoutIndex(
                    e.target.value ? parseInt(e.target.value) : null
                  );
                  setSuccess(false);
                }}
                disabled={isLoadingStageData || selectedScreenIndex === null}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                }}
              >
                <option value="">Select a layout...</option>
                {stageLayouts.map((layout) => (
                  <option key={layout.id.uuid} value={layout.id.index}>
                    {layout.id.name} (Index: {layout.id.index})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStageLayoutChange}
              disabled={
                isLoadingStageData ||
                selectedScreenIndex === null ||
                selectedLayoutIndex === null
              }
              className="secondary"
              style={{ width: "100%", marginTop: "8px" }}
            >
              {isLoadingStageData ? (
                <>
                  <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                  Loading...
                </>
              ) : (
                <>
                  <FaCheck />
                  Set Layout
                </>
              )}
            </button>

            {savedAutomations.some((a) => a.type === "stageLayout") && (
              <button
                onClick={handleRemoveCurrentType}
                className="secondary"
                style={{ width: "100%", marginTop: "8px", color: "#ef4444" }}
              >
                <FaTimes />
                Remove Stage Layout Automation
              </button>
            )}
          </div>
        )}

        {/* Smart Rule Option */}
        {savedAutomations.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "0.9em",
              }}
            >
              <input
                type="checkbox"
                checked={saveAsSmartRule}
                onChange={(e) => setSaveAsSmartRule(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              <FaSave style={{ color: "var(--app-primary-color)" }} />
              <span>
                Save as smart rule (auto-apply to future "{sessionName}"
                sessions)
              </span>
            </label>

            {saveAsSmartRule && (
              <div style={{ marginTop: "8px", marginLeft: "28px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.85em",
                    color: "var(--app-text-color-secondary)",
                  }}
                >
                  <input
                    type="radio"
                    name="matchType"
                    checked={isExactMatch}
                    onChange={() => setIsExactMatch(true)}
                  />
                  <span>Exact name match</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.85em",
                    color: "var(--app-text-color-secondary)",
                    marginTop: "4px",
                  }}
                >
                  <input
                    type="radio"
                    name="matchType"
                    checked={!isExactMatch}
                    onChange={() => setIsExactMatch(false)}
                  />
                  <span>
                    Contains (matches sessions containing "{sessionName}")
                  </span>
                </label>
              </div>
            )}
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
            <div
              style={{
                fontSize: "0.85em",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--app-text-color)",
              }}
            >
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
                    <span style={{ color: "var(--app-text-color)" }}>
                      "{rule.sessionNamePattern}"
                    </span>
                    <span
                      style={{
                        color: "var(--app-text-color-secondary)",
                        marginLeft: "6px",
                      }}
                    >
                      ({rule.isExactMatch ? "exact" : "contains"})
                    </span>
                    <div
                      style={{
                        fontSize: "0.8em",
                        color: "var(--app-text-color-secondary)",
                        marginTop: "2px",
                      }}
                    >
                      {(rule.automations || []).length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          {(rule.automations || []).map((a) => (
                            <div key={a.type}>{getAutomationTypeLabel(a)}</div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ opacity: 0.8 }}>No automations</span>
                      )}
                    </div>
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

        {/* ProPresenter Connection Selector */}
        {enabledConnections.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <label
              style={{
                fontSize: "0.85em",
                display: "block",
                marginBottom: "6px",
                color: "var(--app-text-color-secondary)",
                fontWeight: 600,
              }}
            >
              {automationType === "slide" ? "Get slide from:" : "Get stage data from:"}
            </label>
            {enabledConnections.length === 1 ? (
              <div
                style={{
                  padding: "6px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                }}
              >
                {enabledConnections[0].name} ({enabledConnections[0].apiUrl})
              </div>
            ) : (
              <select
                value={selectedConnectionId}
                onChange={(e) => {
                  setSelectedConnectionId(e.target.value);
                  // Reset stage data when connection changes so user needs to reload
                  if (automationType === "stageLayout") {
                    setStageScreens([]);
                    setStageLayouts([]);
                    setSelectedScreenIndex(null);
                    setSelectedLayoutIndex(null);
                    setSuccess(false);
                    // Auto-reload stage data for the new connection
                    setTimeout(() => loadStageData(), 100);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                }}
              >
                {enabledConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.apiUrl})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          {savedAutomations.length > 0 && (
            <button
              onClick={handleRemove}
              className="secondary"
              style={{ marginRight: "auto" }}
            >
              <FaTimes />
              Remove All
            </button>
          )}
          <button onClick={handleCancel} className="secondary">
            <FaTimes />
            Cancel
          </button>
          {automationType === "slide" && (
            <button
              onClick={handleGetSlide}
              disabled={isLoading || enabledConnections.length === 0}
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
          )}
          {savedAutomations.length > 0 && (
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
