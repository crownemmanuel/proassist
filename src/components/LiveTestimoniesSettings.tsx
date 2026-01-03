import React, { useState, useEffect } from "react";
import { FirebaseConfig, LiveTestimoniesSettings as LiveTestimoniesSettingsType, NameFormattingType } from "../types/testimonies";
import {
  loadFirebaseConfig,
  saveFirebaseConfig,
  loadLiveTestimoniesSettings,
  saveLiveTestimoniesSettings,
} from "../utils/testimoniesStorage";
import { formatNameForCopy } from "../utils/nameUtils";
import "../App.css";

const LiveTestimoniesSettings: React.FC = () => {
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(
    null
  );
  const [outputPath, setOutputPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [nameFormattingType, setNameFormattingType] = useState<NameFormattingType>("default");
  const [customLogic, setCustomLogic] = useState("");
  const [testName, setTestName] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });

  useEffect(() => {
    const settings = loadLiveTestimoniesSettings();
    setFirebaseConfig(settings.firebaseConfig);
    setOutputPath(settings.liveTestimonyOutputPath);
    setFileName(settings.liveTestimonyFileName);
    setNameFormattingType(settings.nameFormatting?.type || "default");
    setCustomLogic(settings.nameFormatting?.customLogic || "");
  }, []);

  const handleFirebaseConfigChange = (
    field: keyof FirebaseConfig,
    value: string
  ) => {
    setFirebaseConfig((prev) => {
      if (!prev) {
        // Initialize with empty config
        return {
          apiKey: "",
          authDomain: "",
          databaseURL: "",
          projectId: "",
          storageBucket: "",
          messagingSenderId: "",
          appId: "",
          [field]: value,
        } as FirebaseConfig;
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage({ text: "", type: "" });

    try {
      if (!firebaseConfig) {
        throw new Error("Firebase configuration is required");
      }

      // Validate required fields
      const requiredFields: (keyof FirebaseConfig)[] = [
        "apiKey",
        "authDomain",
        "databaseURL",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId",
      ];

      for (const field of requiredFields) {
        if (!firebaseConfig[field] || firebaseConfig[field].trim() === "") {
          throw new Error(`Firebase ${field} is required`);
        }
      }

      if (!outputPath.trim()) {
        throw new Error("Output path is required");
      }

      if (!fileName.trim()) {
        throw new Error("File name is required");
      }

      // Save Firebase config
      saveFirebaseConfig(firebaseConfig);

      // Validate custom logic if needed
      if (nameFormattingType !== "default" && !customLogic.trim()) {
        throw new Error("Custom logic is required when not using default formatting");
      }

      // Save settings
      const settings: LiveTestimoniesSettingsType = {
        firebaseConfig,
        liveTestimonyOutputPath: outputPath.trim(),
        liveTestimonyFileName: fileName.trim(),
        nameFormatting: {
          type: nameFormattingType,
          customLogic: nameFormattingType !== "default" ? customLogic.trim() : undefined,
        },
      };
      saveLiveTestimoniesSettings(settings);

      setSaveMessage({ text: "Settings saved successfully", type: "success" });
      setTimeout(() => setSaveMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings";
      setSaveMessage({ text: message, type: "error" });
      setTimeout(() => setSaveMessage({ text: "", type: "" }), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ marginBottom: "var(--spacing-4)" }}>Live Testimonies Settings</h2>

      {/* Link to web app */}
      <div
        style={{
          marginBottom: "var(--spacing-5)",
          padding: "var(--spacing-3)",
          backgroundColor: "var(--app-input-bg-color)",
          borderRadius: "8px",
          border: "1px solid var(--app-border-color)",
        }}
      >
        <p style={{ margin: "0 0 var(--spacing-2) 0", fontWeight: 500 }}>
          Web App Implementation
        </p>
        <p style={{ margin: "0 0 var(--spacing-2) 0", fontSize: "0.9em" }}>
          To implement the web app side of Live Testimonies, visit:
        </p>
        <a
          href="https://github.com/crownemmanuel/LiveTestimonies"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--app-primary-color)",
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          https://github.com/crownemmanuel/LiveTestimonies
        </a>
      </div>

      {/* Firebase Configuration */}
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h3 style={{ marginBottom: "var(--spacing-3)" }}>Firebase Configuration</h3>
          <p style={{ marginBottom: "var(--spacing-3)", fontSize: "0.9em", color: "var(--app-text-color-secondary)" }}>
            Enter your Firebase Realtime Database configuration. You can find these values in your Firebase project settings.
          </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              API Key *
            </label>
            <input
              type="text"
              value={firebaseConfig?.apiKey || ""}
              onChange={(e) => handleFirebaseConfigChange("apiKey", e.target.value)}
              placeholder="AIza..."
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Auth Domain *
            </label>
            <input
              type="text"
              value={firebaseConfig?.authDomain || ""}
              onChange={(e) => handleFirebaseConfigChange("authDomain", e.target.value)}
              placeholder="your-project.firebaseapp.com"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Database URL *
            </label>
            <input
              type="text"
              value={firebaseConfig?.databaseURL || ""}
              onChange={(e) => handleFirebaseConfigChange("databaseURL", e.target.value)}
              placeholder="https://your-project-default-rtdb.firebaseio.com"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Project ID *
            </label>
            <input
              type="text"
              value={firebaseConfig?.projectId || ""}
              onChange={(e) => handleFirebaseConfigChange("projectId", e.target.value)}
              placeholder="your-project-id"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Storage Bucket *
            </label>
            <input
              type="text"
              value={firebaseConfig?.storageBucket || ""}
              onChange={(e) => handleFirebaseConfigChange("storageBucket", e.target.value)}
              placeholder="your-project.appspot.com"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Messaging Sender ID *
            </label>
            <input
              type="text"
              value={firebaseConfig?.messagingSenderId || ""}
              onChange={(e) => handleFirebaseConfigChange("messagingSenderId", e.target.value)}
              placeholder="123456789"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              App ID *
            </label>
            <input
              type="text"
              value={firebaseConfig?.appId || ""}
              onChange={(e) => handleFirebaseConfigChange("appId", e.target.value)}
              placeholder="1:123456789:web:abc123"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
          </div>
        </div>
      </div>

      {/* Output Configuration */}
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h3 style={{ marginBottom: "var(--spacing-3)" }}>Live Testimony Output</h3>
        <p style={{ marginBottom: "var(--spacing-3)", fontSize: "0.9em", color: "var(--app-text-color-secondary)" }}>
          Configure where the live testimony name will be saved when you click the "Live" button.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Output Path *
            </label>
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="/tmp/proassist/live_testimony/"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
            <p style={{ marginTop: "var(--spacing-1)", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
              Directory where the live testimony file will be saved
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              File Name *
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="live_testimony.txt"
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            />
            <p style={{ marginTop: "var(--spacing-1)", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
              Name of the file that will contain the formatted testimony name
            </p>
          </div>
        </div>
      </div>

      {/* Name Formatting Configuration */}
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h3 style={{ marginBottom: "var(--spacing-3)" }}>Name Formatting Logic</h3>
        <p style={{ marginBottom: "var(--spacing-3)", fontSize: "0.9em", color: "var(--text-secondary)" }}>
          Configure how names are formatted when copying or setting live. Default behavior formats names as "FirstName L." (e.g., "John D.") and removes common prefixes.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
              Formatting Type
            </label>
            <select
              value={nameFormattingType}
              onChange={(e) => {
                setNameFormattingType(e.target.value as NameFormattingType);
                setTestResult(null);
              }}
              style={{ width: "100%", padding: "var(--spacing-2)" }}
            >
              <option value="default">Default (FirstName L.)</option>
              <option value="regex">Custom Regex Pattern</option>
              <option value="javascript">Custom JavaScript Function</option>
            </select>
          </div>

          {nameFormattingType !== "default" && (
            <div>
              <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontWeight: 500 }}>
                {nameFormattingType === "regex" ? "Regex Pattern" : "JavaScript Function"} *
              </label>
              {nameFormattingType === "regex" ? (
                <>
                  <input
                    type="text"
                    value={customLogic}
                    onChange={(e) => {
                      setCustomLogic(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder='e.g., "^([A-Z][a-z]+)\\s+([A-Z])"'
                    style={{ width: "100%", padding: "var(--spacing-2)", fontFamily: "monospace" }}
                  />
                  <p style={{ marginTop: "var(--spacing-1)", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
                    Enter a regex pattern. The first match will be used as the formatted name.
                  </p>
                </>
              ) : (
                <>
                  <textarea
                    value={customLogic}
                    onChange={(e) => {
                      setCustomLogic(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={`// Example: return name.split(' ')[0] + ' ' + name.split(' ')[name.split(' ').length - 1][0] + '.';\n// Function receives 'name' as parameter and should return a string\nreturn name.trim();`}
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "var(--spacing-2)",
                      fontFamily: "monospace",
                      fontSize: "0.9em",
                    }}
                  />
                  <p style={{ marginTop: "var(--spacing-1)", fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
                    Enter JavaScript code. The function receives <code>name</code> as a parameter and should return a formatted string.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Test Section */}
          <div
            style={{
              marginTop: "var(--spacing-2)",
              padding: "var(--spacing-3)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "8px",
              border: "1px solid var(--app-border-color)",
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: "var(--spacing-2)", fontSize: "1em" }}>
              Test Formatting
            </h4>
            <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "var(--spacing-1)", fontSize: "0.875rem" }}>
                  Test Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => {
                    setTestName(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder='e.g., "Brother John Doe"'
                  style={{ width: "100%", padding: "var(--spacing-2)" }}
                />
              </div>
              <button
                onClick={() => {
                  if (!testName.trim()) {
                    setTestResult("Please enter a test name");
                    return;
                  }
                  if (nameFormattingType !== "default" && !customLogic.trim()) {
                    setTestResult("Please enter custom logic first");
                    return;
                  }
                  try {
                    const result = formatNameForCopy(testName, {
                      type: nameFormattingType,
                      customLogic: nameFormattingType !== "default" ? customLogic : undefined,
                    });
                    setTestResult(`Result: "${result}"`);
                  } catch (error) {
                    setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }}
                className="secondary"
                style={{ whiteSpace: "nowrap" }}
              >
                Test
              </button>
            </div>
            {testResult && (
              <div
                style={{
                  marginTop: "var(--spacing-2)",
                  padding: "var(--spacing-2)",
                  backgroundColor: testResult.startsWith("Error")
                    ? "rgba(220, 38, 38, 0.1)"
                    : "rgba(34, 197, 94, 0.1)",
                  borderRadius: "4px",
                  fontSize: "0.9em",
                  color: testResult.startsWith("Error")
                    ? "rgb(220, 38, 38)"
                    : "rgb(34, 197, 94)",
                }}
              >
                {testResult}
              </div>
            )}
          </div>

          {/* Default Formatting Info */}
          {nameFormattingType === "default" && (
            <div
              style={{
                padding: "var(--spacing-3)",
                backgroundColor: "var(--app-input-bg-color)",
                borderRadius: "8px",
                border: "1px solid var(--app-border-color)",
              }}
            >
              <h4 style={{ marginTop: 0, marginBottom: "var(--spacing-2)", fontSize: "1em" }}>
                Default Formatting Behavior
              </h4>
              <ul style={{ margin: 0, paddingLeft: "var(--spacing-4)", fontSize: "0.9em" }}>
                <li>Removes common prefixes (Brother, Sister, Pastor, Dr., etc.)</li>
                <li>Formats as "FirstName L." (e.g., "John Doe" → "John D.")</li>
                <li>Capitalizes first letter of first name</li>
                <li>Uses last initial with period</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="primary"
          style={{ minWidth: "120px" }}
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
        {saveMessage.text && (
          <span
            style={{
              color:
                saveMessage.type === "success"
                  ? "#22c55e"
                  : "#dc2626",
              fontSize: "0.9em",
            }}
          >
            {saveMessage.text}
          </span>
        )}
      </div>
    </div>
  );
};

export default LiveTestimoniesSettings;
