/**
 * Screen 3: Transcription Provider Selection
 */

import React, { useState } from "react";
import { FaCloud, FaCoins, FaLaptop } from "react-icons/fa";
import "./onboarding.css";

interface TranscriptionProviderScreenProps {
  selectedProvider?: "assemblyai" | "groq" | "offline-whisper" | "offline-moonshine";
  onSelectProvider: (
    provider: "assemblyai" | "groq" | "offline-whisper" | "offline-moonshine"
  ) => void;
  onBack: () => void;
  onSkip: () => void;
}

type TabType = "cloud" | "free" | "offline";

const TranscriptionProviderScreen: React.FC<
  TranscriptionProviderScreenProps
> = ({ selectedProvider, onSelectProvider, onBack, onSkip }) => {
  const [activeTab, setActiveTab] = useState<TabType>("cloud");

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <h1 className="onboarding-title">Choose Transcription Provider</h1>
        <p className="onboarding-subtitle">
          Select how Smart Verses will transcribe audio from your services.
        </p>

        {/* Icon tabs */}
        <div className="onboarding-tabs">
          <div
            className={`onboarding-tab ${activeTab === "cloud" ? "active" : ""}`}
            onClick={() => setActiveTab("cloud")}
          >
            <FaCloud className="onboarding-tab-icon" />
            <span className="onboarding-tab-label">Cloud</span>
          </div>
          <div
            className={`onboarding-tab ${activeTab === "free" ? "active" : ""}`}
            onClick={() => setActiveTab("free")}
          >
            <FaCoins className="onboarding-tab-icon" />
            <span className="onboarding-tab-label">Free</span>
          </div>
          <div
            className={`onboarding-tab ${activeTab === "offline" ? "active" : ""}`}
            onClick={() => setActiveTab("offline")}
          >
            <FaLaptop className="onboarding-tab-icon" />
            <span className="onboarding-tab-label">Offline</span>
          </div>
        </div>

        {/* Provider cards based on active tab */}
        <div className="onboarding-cards">
          {activeTab === "cloud" && (
            <div
              className={`onboarding-card ${
                selectedProvider === "assemblyai" ? "selected" : ""
              }`}
              onClick={() => onSelectProvider("assemblyai")}
            >
              <h3 className="onboarding-card-title">
                AssemblyAI
                <span className="onboarding-card-tag">Most accurate · Recommended</span>
              </h3>
              <p className="onboarding-card-text">
                Cloud transcription powered by AssemblyAI.
              </p>
            </div>
          )}

          {activeTab === "free" && (
            <>
              <div
                className={`onboarding-card ${
                  selectedProvider === "groq" ? "selected" : ""
                }`}
                onClick={() => onSelectProvider("groq")}
              >
                <h3 className="onboarding-card-title">Groq</h3>
                <p className="onboarding-card-text">
                  Fast cloud transcription with a generous free tier.
                </p>
              </div>
              <div
                className={`onboarding-card ${
                  selectedProvider === "offline-whisper" ? "selected" : ""
                }`}
                onClick={() => onSelectProvider("offline-whisper")}
              >
                <h3 className="onboarding-card-title">
                  Whisper
                  <span className="onboarding-card-tag">Recommended</span>
                </h3>
                <p className="onboarding-card-text">
                  Free offline transcription using Whisper models. Runs locally on your device.
                </p>
              </div>
              <div
                className={`onboarding-card ${
                  selectedProvider === "offline-moonshine" ? "selected" : ""
                }`}
                onClick={() => onSelectProvider("offline-moonshine")}
              >
                <h3 className="onboarding-card-title">Moonshine</h3>
                <p className="onboarding-card-text">
                  Free offline transcription using Moonshine models. Optimized for real-time use.
                </p>
              </div>
            </>
          )}

          {activeTab === "offline" && (
            <>
              <div
                className={`onboarding-card ${
                  selectedProvider === "offline-whisper" ? "selected" : ""
                }`}
                onClick={() => onSelectProvider("offline-whisper")}
              >
                <h3 className="onboarding-card-title">
                  Whisper
                  <span className="onboarding-card-tag">Recommended</span>
                </h3>
                <p className="onboarding-card-text">
                  Local transcription using OpenAI Whisper models. No internet required after download.
                </p>
              </div>
              <div
                className={`onboarding-card ${
                  selectedProvider === "offline-moonshine" ? "selected" : ""
                }`}
                onClick={() => onSelectProvider("offline-moonshine")}
              >
                <h3 className="onboarding-card-title">Moonshine</h3>
                <p className="onboarding-card-text">
                  Local transcription optimized for real-time performance. No internet required.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="onboarding-buttons">
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

export default TranscriptionProviderScreen;
