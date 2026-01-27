/**
 * Screen 7: Paraphrasing LLM Setup
 */

import React, { useState, useEffect } from "react";
import { getAppSettings } from "../../utils/aiConfig";
import {
  loadSmartVersesSettings,
  saveSmartVersesSettings,
} from "../../services/transcriptionService";
import "./onboarding.css";

interface ParaphrasingSetupScreenProps {
  provider?: "openai" | "gemini" | "groq";
  onProviderChange: (provider?: "openai" | "gemini" | "groq") => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const ParaphrasingSetupScreen: React.FC<ParaphrasingSetupScreenProps> = ({
  provider,
  onProviderChange,
  onNext,
  onBack,
  onSkip,
}) => {
  const [availableProviders, setAvailableProviders] = useState<
    { value: string; label: string; hasKey: boolean }[]
  >([]);

  useEffect(() => {
    const appSettings = getAppSettings();
    const providers = [
      {
        value: "openai",
        label: "OpenAI",
        hasKey: !!appSettings.openAIConfig?.apiKey,
      },
      {
        value: "gemini",
        label: "Google Gemini",
        hasKey: !!appSettings.geminiConfig?.apiKey,
      },
      {
        value: "groq",
        label: "Groq (Recommended - Super Fast)",
        hasKey: !!appSettings.groqConfig?.apiKey,
      },
    ];
    setAvailableProviders(providers);

    // Auto-select Groq if available
    if (!provider && appSettings.groqConfig?.apiKey) {
      onProviderChange("groq");
    }
  }, [provider, onProviderChange]);

  const handleProviderSelect = (selectedProvider: string) => {
    const providerValue = selectedProvider as "openai" | "gemini" | "groq";
    onProviderChange(providerValue);

    // Save to settings
    const settings = loadSmartVersesSettings();
    settings.bibleSearchProvider = providerValue;
    saveSmartVersesSettings(settings);
  };

  const providersWithKeys = availableProviders.filter((p) => p.hasKey);

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <h1 className="onboarding-title">Paraphrasing & AI Features</h1>
        <p className="onboarding-body">
          Select an AI provider for paraphrase detection and Bible search. This
          allows Smart Verses to detect scriptures even when they're not quoted
          directly.
        </p>

        {providersWithKeys.length === 0 ? (
          <div className="onboarding-message onboarding-message-warning">
            <strong>No AI providers configured</strong>
            <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
              You haven't set up any AI providers yet. You can configure them in
              Settings → AI Configuration after onboarding, or skip this step for
              now.
            </p>
          </div>
        ) : (
          <div className="onboarding-cards">
            {providersWithKeys.map((p) => (
              <div
                key={p.value}
                className={`onboarding-card ${
                  provider === p.value ? "selected" : ""
                }`}
                onClick={() => handleProviderSelect(p.value)}
              >
                <h3 className="onboarding-card-title">
                  {p.label}
                  {p.value === "groq" && (
                    <span className="onboarding-card-tag">Recommended</span>
                  )}
                </h3>
                <p className="onboarding-card-text">
                  {p.value === "openai" &&
                    "High-quality paraphrase detection with GPT models."}
                  {p.value === "gemini" &&
                    "Fast and accurate detection with Google's Gemini."}
                  {p.value === "groq" &&
                    "Ultra-fast detection with generous free tier."}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="onboarding-help-text">
          API keys are configured in Settings → AI Configuration. You can set
          these up later if needed.
        </p>

        <div className="onboarding-buttons">
          <button
            onClick={onNext}
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

export default ParaphrasingSetupScreen;
