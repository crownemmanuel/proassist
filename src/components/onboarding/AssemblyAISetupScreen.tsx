/**
 * Screen 4: AssemblyAI Setup
 */

import React, { useState } from "react";
import { FaCheck, FaTimes, FaExternalLinkAlt } from "react-icons/fa";
import { getAssemblyAITemporaryToken } from "../../services/assemblyaiTokenService";
import { saveSmartVersesSettings, loadSmartVersesSettings } from "../../services/transcriptionService";
import "./onboarding.css";

interface AssemblyAISetupScreenProps {
  apiKey?: string;
  onApiKeyChange: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const AssemblyAISetupScreen: React.FC<AssemblyAISetupScreenProps> = ({
  apiKey,
  onApiKeyChange,
  onNext,
  onBack,
  onSkip,
}) => {
  const [key, setKey] = useState(apiKey || "");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const handleKeyChange = (value: string) => {
    setKey(value);
    onApiKeyChange(value);
    setTestStatus("idle");
    setTestMessage("");
  };

  const handleTestKey = async () => {
    if (!key) {
      setTestStatus("error");
      setTestMessage("Please enter an API key first");
      return;
    }

    setTesting(true);
    setTestStatus("idle");
    setTestMessage("");

    try {
      await getAssemblyAITemporaryToken(key, 60);
      setTestStatus("success");
      setTestMessage("API key verified successfully");
      
      // Save to settings
      const settings = loadSmartVersesSettings();
      settings.assemblyAIApiKey = key;
      settings.transcriptionEngine = "assemblyai";
      saveSmartVersesSettings(settings);
    } catch (err) {
      setTestStatus("error");
      const message = err instanceof Error ? err.message : String(err);
      setTestMessage(`Failed to verify API key: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleNext = () => {
    if (key && testStatus !== "success") {
      // If they have a key but haven't tested it, show a warning
      const proceed = window.confirm(
        "You haven't tested your API key yet. Continue anyway?"
      );
      if (!proceed) return;
    }
    onNext();
  };

  const openAssemblyAI = () => {
    window.open("https://www.assemblyai.com/dashboard", "_blank");
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <h1 className="onboarding-title">Connect AssemblyAI</h1>
        <p className="onboarding-body">
          Enter your AssemblyAI API key so Smart Verses can transcribe your
          services in the cloud.
        </p>

        {/* API Key Input */}
        <div className="onboarding-form-field">
          <label className="onboarding-label" htmlFor="assemblyai-key">
            AssemblyAI API Key
          </label>
          <div className="onboarding-input-group">
            <input
              id="assemblyai-key"
              type="password"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="Enter your AssemblyAI API key"
              className="onboarding-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleTestKey}
              disabled={testing || !key}
              className="onboarding-button onboarding-button-secondary"
            >
              {testing ? (
                <>
                  <span className="onboarding-spinner"></span>
                  Testing...
                </>
              ) : (
                "Test API key"
              )}
            </button>
          </div>

          {/* Test Status */}
          {testStatus === "success" && (
            <div className="onboarding-message onboarding-message-success">
              <FaCheck style={{ marginRight: "8px" }} />
              {testMessage}
            </div>
          )}
          {testStatus === "error" && (
            <div className="onboarding-message onboarding-message-error">
              <FaTimes style={{ marginRight: "8px" }} />
              {testMessage}
            </div>
          )}
        </div>

        {/* Link to AssemblyAI Dashboard */}
        <button
          onClick={openAssemblyAI}
          className="onboarding-button onboarding-button-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <FaExternalLinkAlt />
          Open AssemblyAI dashboard
        </button>

        {/* Important Note */}
        <div className="onboarding-message onboarding-message-info">
          <strong>Important:</strong> To use AssemblyAI, you must add credits to
          your AssemblyAI account. Without credits, transcription requests will
          not work.
        </div>

        <div className="onboarding-buttons">
          <button
            onClick={handleNext}
            disabled={!key}
            className="onboarding-button onboarding-button-primary"
          >
            Next
          </button>
          <button
            onClick={onBack}
            className="onboarding-button onboarding-button-secondary"
          >
            Back
          </button>
          <button
            onClick={onSkip}
            className="onboarding-button onboarding-button-tertiary"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssemblyAISetupScreen;
