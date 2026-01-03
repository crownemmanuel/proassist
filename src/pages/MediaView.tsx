import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  getTestimoniesByDateAndService,
  setLiveTestimony,
  clearLiveTestimony,
  getLiveTestimony,
  subscribeToLiveTestimony,
  getServices,
} from "../services/firebaseService";
import { Testimony, LiveTestimony, ServiceType, FirebaseConfig } from "../types/testimonies";
import { formatNameForCopy } from "../utils/nameUtils";
import {
  loadFirebaseConfig,
  loadLiveTestimoniesSettings,
} from "../utils/testimoniesStorage";
import "../App.css";

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MediaView: React.FC = () => {
  const [date, setDate] = useState(getTodayDate());
  const [service, setService] = useState("");
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLive, setCurrentLive] = useState<LiveTestimony | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Firebase config
    const config = loadFirebaseConfig();
    if (!config) {
      setError("Firebase configuration not found. Please configure it in Settings > Live Testimonies.");
      return;
    }
    setFirebaseConfig(config);

    // Load services
    const loadServicesData = async () => {
      try {
        const loadedServices = await getServices(config);
        setServices(loadedServices);
        if (loadedServices.length > 0) {
          setService(loadedServices[0].key);
        }
      } catch (err) {
        console.error("Failed to load services:", err);
        setError("Failed to load services. Check your Firebase configuration.");
      }
    };
    loadServicesData();

    // Load current live testimony
    const loadCurrentLive = async () => {
      try {
        const live = await getLiveTestimony(config);
        setCurrentLive(live);
      } catch (err) {
        console.error("Failed to load current live:", err);
      }
    };
    loadCurrentLive();

    // Subscribe to live testimony changes
    const unsubscribe = subscribeToLiveTestimony(config, (live) => {
      setCurrentLive(live);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (firebaseConfig && service && date) {
      loadTestimonies();
    }
  }, [date, service, firebaseConfig]);

  const loadTestimonies = async () => {
    if (!firebaseConfig || !service) return;
    setIsLoading(true);
    setError(null);
    try {
      // Load all testimonies regardless of status
      const data = await getTestimoniesByDateAndService(
        firebaseConfig,
        date,
        service
      );
      setTestimonies(data);
    } catch (err) {
      console.error("Failed to load testimonies:", err);
      setError("Failed to load testimonies. Check your Firebase configuration and connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyName = async (testimony: Testimony) => {
    const settings = loadLiveTestimoniesSettings();
    const formattedName = formatNameForCopy(testimony.name, settings.nameFormatting);
    try {
      await navigator.clipboard.writeText(formattedName);
      setCopiedId(testimony.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy name to clipboard");
    }
  };

  const handleSetLive = async (testimony: Testimony) => {
    if (!firebaseConfig) {
      alert("Firebase configuration not found. Please configure it in Settings.");
      return;
    }

    // CRITICAL: Use formatNameForCopy with settings for the displayName
    const settings = loadLiveTestimoniesSettings();
    const formattedName = formatNameForCopy(testimony.name, settings.nameFormatting);
    
    try {
      // Set live in Firebase
      await setLiveTestimony(firebaseConfig, {
        testimonyId: testimony.id,
        displayName: formattedName,
        name: testimony.name,
        updatedAt: Date.now(),
      });

      // Save to text file
      const filePath = `${settings.liveTestimonyOutputPath.replace(/\/?$/, "/")}${
        settings.liveTestimonyFileName
      }`;

      await invoke("write_text_to_file", {
        filePath,
        content: formattedName,
      });

      setCurrentLive({
        testimonyId: testimony.id,
        displayName: formattedName,
        name: testimony.name,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to set live:", error);
      alert("Failed to set live testimony. Check console for details.");
    }
  };

  const handleClearLive = async () => {
    if (!firebaseConfig) return;
    try {
      await clearLiveTestimony(firebaseConfig);
      
      // Clear the text file
      const settings = loadLiveTestimoniesSettings();
      const filePath = `${settings.liveTestimonyOutputPath.replace(/\/?$/, "/")}${
        settings.liveTestimonyFileName
      }`;

      await invoke("write_text_to_file", {
        filePath,
        content: "",
      });

      setCurrentLive(null);
    } catch (error) {
      console.error("Failed to clear live:", error);
      alert("Failed to clear live testimony. Check console for details.");
    }
  };

  if (error && !firebaseConfig) {
    return (
      <div style={{ padding: "var(--spacing-5)", color: "var(--error)" }}>
        <h2>Configuration Required</h2>
        <p>{error}</p>
        <p>
          Please go to <strong>Settings → Live Testimonies</strong> to configure Firebase.
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "var(--spacing-4)", 
      minHeight: "calc(100vh - 51px)",
      backgroundColor: "var(--app-bg-color)",
      color: "var(--app-text-color)",
    }}>
      <header style={{ marginBottom: "var(--spacing-4)" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "var(--app-text-color)" }}>Media View</h1>
      </header>

      {/* Current Live Indicator */}
      {currentLive && (
        <div
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.9)",
            borderRadius: "12px",
            padding: "var(--spacing-4)",
            marginBottom: "var(--spacing-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
            <span
              style={{
                position: "relative",
                display: "flex",
                height: "12px",
                width: "12px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                  height: "100%",
                  width: "100%",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  opacity: 0.75,
                }}
              />
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  borderRadius: "50%",
                  height: "12px",
                  width: "12px",
                  backgroundColor: "white",
                }}
              />
            </span>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.8 }}>
                Currently Live:
              </p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "1.125rem" }}>
                {currentLive.displayName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearLive}
            style={{
              padding: "var(--spacing-2) var(--spacing-4)",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          backgroundColor: "var(--app-input-bg-color)",
          borderRadius: "12px",
          padding: "var(--spacing-4)",
          marginBottom: "var(--spacing-4)",
          border: "1px solid var(--app-border-color)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--spacing-4)",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 150px" }}>
            <label
              style={{
                display: "block",
                color: "var(--app-text-color-secondary)",
                fontSize: "0.875rem",
                marginBottom: "var(--spacing-2)",
              }}
            >
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--spacing-3)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
              }}
            />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label
              style={{
                display: "block",
                color: "var(--app-text-color-secondary)",
                fontSize: "0.875rem",
                marginBottom: "var(--spacing-2)",
              }}
            >
              Service
            </label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              disabled={services.length === 0}
              style={{
                width: "100%",
                padding: "var(--spacing-3)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
              }}
            >
              <option value="">Select Service</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.key}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadTestimonies}
            disabled={!service || isLoading}
            className="primary"
            style={{ minWidth: "100px" }}
          >
            {isLoading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: "var(--spacing-3)",
            backgroundColor: "var(--error)",
            color: "white",
            borderRadius: "8px",
            marginBottom: "var(--spacing-4)",
          }}
        >
          {error}
        </div>
      )}

      {/* Testimonies List */}
      {!service ? (
        <div style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
          <p style={{ color: "var(--app-text-color-secondary)" }}>
            Select a date and service to view approved testimonies
          </p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
          <p style={{ color: "var(--app-text-color-secondary)" }}>Loading...</p>
        </div>
      ) : testimonies.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--spacing-8)" }}>
          <p style={{ color: "var(--app-text-color-secondary)" }}>
            No testimonies found
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-2)" }}>
          {testimonies.map((testimony) => {
            const isLive = currentLive?.testimonyId === testimony.id;
            const isCopied = copiedId === testimony.id;

            return (
              <div
                key={testimony.id}
                style={{
                  borderRadius: "12px",
                  padding: "var(--spacing-4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isLive
                    ? "rgba(220, 38, 38, 0.3)"
                    : "var(--app-input-bg-color)",
                  border: isLive
                    ? "1px solid rgba(220, 38, 38, 0.5)"
                    : "1px solid var(--app-border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
                  {isLive && (
                    <span
                      style={{
                        position: "relative",
                        display: "flex",
                        height: "10px",
                        width: "10px",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                          height: "100%",
                          width: "100%",
                          borderRadius: "50%",
                          backgroundColor: "rgb(248, 113, 113)",
                          opacity: 0.75,
                        }}
                      />
                      <span
                        style={{
                          position: "relative",
                          display: "inline-flex",
                          borderRadius: "50%",
                          height: "10px",
                          width: "10px",
                          backgroundColor: "rgb(239, 68, 68)",
                        }}
                      />
                    </span>
                  )}
                  {/* Status badge */}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      backgroundColor:
                        testimony.status === "approved"
                          ? "rgba(34, 197, 94, 0.2)"
                          : testimony.status === "pending"
                          ? "rgba(251, 191, 36, 0.2)"
                          : "rgba(220, 38, 38, 0.2)",
                      color:
                        testimony.status === "approved"
                          ? "rgb(34, 197, 94)"
                          : testimony.status === "pending"
                          ? "rgb(251, 191, 36)"
                          : "rgb(220, 38, 38)",
                    }}
                  >
                    {testimony.status}
                  </span>
                  <span style={{ color: "var(--app-text-color)", fontWeight: 500, fontSize: "1.125rem" }}>
                    {testimony.name}
                  </span>
                  <span style={{ color: "var(--app-text-color-secondary)", fontSize: "0.875rem" }}>
                    → {formatNameForCopy(testimony.name, loadLiveTestimoniesSettings().nameFormatting)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                  <button
                    onClick={() => handleCopyName(testimony)}
                    className={isCopied ? "" : "secondary"}
                    style={{
                      padding: "var(--spacing-2) var(--spacing-4)",
                      fontWeight: 500,
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: isCopied
                        ? "var(--success)"
                        : "rgb(37, 99, 235)",
                      color: "white",
                    }}
                  >
                    {isCopied ? "Copied!" : "Copy Name"}
                  </button>
                  <button
                    onClick={() => handleSetLive(testimony)}
                    disabled={isLive}
                    style={{
                      padding: "var(--spacing-2) var(--spacing-4)",
                      fontWeight: 500,
                      borderRadius: "8px",
                      border: "none",
                      cursor: isLive ? "default" : "pointer",
                      backgroundColor: isLive
                        ? "rgb(220, 38, 38)"
                        : "rgb(147, 51, 234)",
                      color: "white",
                      opacity: isLive ? 0.7 : 1,
                    }}
                  >
                    Live
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Count */}
      {testimonies.length > 0 && (
        <div
          style={{
            marginTop: "var(--spacing-4)",
            textAlign: "center",
            color: "var(--app-text-color-secondary)",
            fontSize: "0.875rem",
          }}
        >
          {testimonies.length} testimon{testimonies.length === 1 ? "y" : "ies"} (
          {testimonies.filter((t) => t.status === "approved").length} approved,{" "}
          {testimonies.filter((t) => t.status === "pending").length} pending,{" "}
          {testimonies.filter((t) => t.status === "declined").length} declined)
        </div>
      )}
    </div>
  );
};

export default MediaView;
