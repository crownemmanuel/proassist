/**
 * Screen 8: Microphone Setup
 */

import React, { useState, useEffect } from "react";
import { FaMicrophone, FaCheck } from "react-icons/fa";
import {
  loadSmartVersesSettings,
  saveSmartVersesSettings,
} from "../../services/transcriptionService";
import "./onboarding.css";

interface MicSetupScreenProps {
  selectedMicId?: string;
  onMicSelect: (micId?: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const MicSetupScreen: React.FC<MicSetupScreenProps> = ({
  selectedMicId,
  onMicSelect,
  onNext,
  onBack,
  onSkip,
}) => {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadMicrophones();
  }, []);

  const loadMicrophones = async () => {
    setLoading(true);
    setError(null);

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionGranted(true);

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setMics(audioInputs);

      // Auto-select default if nothing selected
      if (!selectedMicId && audioInputs.length > 0) {
        const defaultMic = audioInputs[0];
        onMicSelect(defaultMic.deviceId);

        // Save to settings
        const settings = loadSmartVersesSettings();
        settings.selectedMicrophoneId = defaultMic.deviceId;
        saveSmartVersesSettings(settings);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to access microphone. Please grant permission."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMicSelect = (micId: string) => {
    onMicSelect(micId);

    // Save to settings
    const settings = loadSmartVersesSettings();
    settings.selectedMicrophoneId = micId;
    saveSmartVersesSettings(settings);
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <h1 className="onboarding-title">Select Microphone</h1>
        <p className="onboarding-body">
          Choose the microphone that will capture audio for transcription. This
          is typically the microphone that picks up your pastor or speaker.
        </p>

        {loading && (
          <div className="onboarding-message onboarding-message-info">
            <span className="onboarding-spinner"></span>
            Loading microphones...
          </div>
        )}

        {error && (
          <div className="onboarding-message onboarding-message-error">
            {error}
            <button
              onClick={loadMicrophones}
              className="onboarding-button onboarding-button-secondary"
              style={{ marginTop: "12px" }}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && permissionGranted && (
          <>
            {mics.length === 0 ? (
              <div className="onboarding-message onboarding-message-warning">
                No microphones found. Please connect a microphone and try again.
              </div>
            ) : (
              <div className="onboarding-cards">
                {mics.map((mic) => (
                  <div
                    key={mic.deviceId}
                    className={`onboarding-card ${
                      selectedMicId === mic.deviceId ? "selected" : ""
                    }`}
                    onClick={() => handleMicSelect(mic.deviceId)}
                  >
                    <h3 className="onboarding-card-title">
                      <FaMicrophone style={{ marginRight: "8px" }} />
                      {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                      {selectedMicId === mic.deviceId && (
                        <FaCheck
                          style={{ marginLeft: "8px", color: "var(--success)" }}
                        />
                      )}
                    </h3>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="onboarding-help-text">
          You can change this later in Settings → SmartVerses → Microphone.
        </p>

        <div className="onboarding-buttons">
          <button
            onClick={onNext}
            disabled={!selectedMicId && !error}
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

export default MicSetupScreen;
