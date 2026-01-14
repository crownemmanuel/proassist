import React, { useState, useEffect } from "react";
import { FaSync, FaCheck, FaCheckDouble, FaCloud } from "react-icons/fa";
import { Slide, LayoutType } from "../types";
import {
  fetchSlidesFromMaster,
  MasterSlidesResponse,
  loadLiveSlidesSettings,
} from "../services/liveSlideService";
import { loadNetworkSyncSettings } from "../services/networkSyncService";
import { LiveSlideSession, LiveSlide } from "../types/liveSlides";
import "../App.css";

interface ImportFromNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (
    itemName: string,
    templateName: string,
    slides: Pick<Slide, "text" | "layout" | "isAutoScripture">[],
    options?: { liveSlidesSessionId?: string; liveSlidesLinked?: boolean }
  ) => void;
  existingSessionIds: string[]; // IDs of sessions already in local playlists
}

const LIVE_SLIDES_TEMPLATE_NAME = "Live Slides";

const ImportFromNetworkModal: React.FC<ImportFromNetworkModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingSessionIds,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterSessions, setMasterSessions] = useState<LiveSlideSession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(
    new Set()
  );
  const [importedCount, setImportedCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Get connection info from settings
  const networkSyncSettings = loadNetworkSyncSettings();
  const liveSlidesSettings = loadLiveSlidesSettings();
  const masterHost = networkSyncSettings.remoteHost;
  const masterPort = liveSlidesSettings.serverPort || 9876;

  // Auto-fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setMasterSessions([]);
      setSelectedSessionIds(new Set());
      setImportedCount(0);
      setShowSuccess(false);
      
      // Auto-fetch sessions
      handleFetch();
    }
  }, [isOpen]);

  const handleFetch = async () => {
    if (!masterHost.trim()) {
      setError("Master host not configured. Please set up network sync in Settings → Network.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMasterSessions([]);
    setSelectedSessionIds(new Set());

    try {
      const response: MasterSlidesResponse = await fetchSlidesFromMaster(
        masterHost.trim(),
        masterPort
      );

      if (!response.server_running) {
        setError("Master server is not running");
        return;
      }

      setMasterSessions(response.sessions);

      // Auto-select sessions that don't exist locally
      const newSessions = response.sessions.filter(
        (s) => !existingSessionIds.includes(s.id)
      );
      setSelectedSessionIds(new Set(newSessions.map((s) => s.id)));

      if (response.sessions.length === 0) {
        setError("No sessions found on master server");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to connect to master (${masterHost}:${masterPort}): ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const selectableSessions = masterSessions.filter(
      (s) => !existingSessionIds.includes(s.id)
    );
    setSelectedSessionIds(new Set(selectableSessions.map((s) => s.id)));
  };

  const selectNone = () => {
    setSelectedSessionIds(new Set());
  };

  const convertLiveSlidesToSlides = (
    liveSlides: LiveSlide[]
  ): Pick<Slide, "text" | "layout" | "isAutoScripture">[] => {
    return liveSlides.map((liveSlide) => {
      const text = liveSlide.items.map((item) => item.text).join("\n");
      const itemCount = liveSlide.items.length;
      const layoutName = (() => {
        const names: Record<number, string> = {
          1: "one",
          2: "two",
          3: "three",
          4: "four",
          5: "five",
          6: "six",
        };
        return names[Math.min(itemCount, 6)] || "one";
      })();
      const layout = `${layoutName}-line` as LayoutType;

      return { text, layout, isAutoScripture: false };
    });
  };

  const handleImport = () => {
    let imported = 0;

    masterSessions.forEach((session) => {
      if (selectedSessionIds.has(session.id)) {
        const slides = convertLiveSlidesToSlides(session.slides);
        onImport(session.name, LIVE_SLIDES_TEMPLATE_NAME, slides, {
          liveSlidesSessionId: session.id,
          liveSlidesLinked: false, // Not live-linked since it's a backup import
        });
        imported++;
      }
    });

    setImportedCount(imported);
    setShowSuccess(true);
  };

  const newSessionsCount = masterSessions.filter(
    (s) => !existingSessionIds.includes(s.id)
  ).length;

  const existingSessionsCount = masterSessions.filter((s) =>
    existingSessionIds.includes(s.id)
  ).length;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "650px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FaCloud />
          Import Slides from Network
        </h2>

        {showSuccess ? (
          <div
            style={{
              padding: "24px",
              borderRadius: "8px",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "12px" }}>✓</div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "1.1em",
                marginBottom: "8px",
                color: "#22c55e",
              }}
            >
              Import Complete!
            </div>
            <div
              style={{
                color: "var(--app-text-color-secondary)",
                fontSize: "0.9em",
              }}
            >
              Successfully imported {importedCount} session
              {importedCount !== 1 ? "s" : ""} from master.
            </div>
          </div>
        ) : (
          <>
            {/* Connection Info */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-header-bg)",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "var(--app-text-color-secondary)", fontSize: "0.85em" }}>
                  Fetching from:
                </span>{" "}
                <span style={{ fontWeight: 500 }}>
                  {masterHost}:{masterPort}
                </span>
              </div>
              <button
                onClick={handleFetch}
                className="btn-sm"
                disabled={isLoading}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FaSync className={isLoading ? "spin" : ""} />
                {isLoading ? "Fetching..." : "Refresh"}
              </button>
            </div>

            {isLoading && masterSessions.length === 0 && (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                <FaSync className="spin" style={{ fontSize: "24px", marginBottom: "12px" }} />
                <div>Fetching sessions from master...</div>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(220, 38, 38, 0.1)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  color: "#EF4444",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            {/* Sessions List */}
            {masterSessions.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>
                      Found {masterSessions.length} session
                      {masterSessions.length !== 1 ? "s" : ""}
                    </span>
                    {existingSessionsCount > 0 && (
                      <span
                        style={{
                          color: "var(--app-text-color-secondary)",
                          fontSize: "0.9em",
                          marginLeft: "8px",
                        }}
                      >
                        ({existingSessionsCount} already imported)
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={selectAll}
                      className="btn-sm"
                      disabled={newSessionsCount === 0}
                      title="Select all new sessions"
                    >
                      <FaCheckDouble style={{ marginRight: "4px" }} /> Select All New
                    </button>
                    <button
                      onClick={selectNone}
                      className="btn-sm"
                      disabled={selectedSessionIds.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                    border: "1px solid var(--app-border-color)",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  {masterSessions.map((session) => {
                    const isExisting = existingSessionIds.includes(session.id);
                    const isSelected = selectedSessionIds.has(session.id);

                    return (
                      <div
                        key={session.id}
                        onClick={() => !isExisting && toggleSession(session.id)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--app-border-color)",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          cursor: isExisting ? "not-allowed" : "pointer",
                          backgroundColor: isSelected
                            ? "var(--app-playlist-item-selected-bg)"
                            : isExisting
                            ? "rgba(128, 128, 128, 0.1)"
                            : "transparent",
                          opacity: isExisting ? 0.6 : 1,
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "4px",
                            border: `2px solid ${
                              isSelected
                                ? "var(--app-primary-color)"
                                : "var(--app-border-color)"
                            }`,
                            backgroundColor: isSelected
                              ? "var(--app-primary-color)"
                              : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <FaCheck
                              style={{ color: "white", fontSize: "10px" }}
                            />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 500,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {session.name}
                            {isExisting && (
                              <span
                                style={{
                                  fontSize: "0.75em",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor:
                                    "var(--app-text-color-secondary)",
                                  color: "var(--app-bg-color)",
                                }}
                              >
                                Already Imported
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "0.85em",
                              color: "var(--app-text-color-secondary)",
                              marginTop: "2px",
                            }}
                          >
                            {session.slides.length} slide
                            {session.slides.length !== 1 ? "s" : ""}
                            {session.slides.length > 0 && (
                              <span>
                                {" "}
                                •{" "}
                                {session.slides[0].items
                                  .map((i) => i.text)
                                  .join(" / ")
                                  .slice(0, 50)}
                                {session.slides[0].items
                                  .map((i) => i.text)
                                  .join(" / ").length > 50
                                  ? "..."
                                  : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!isLoading && masterSessions.length === 0 && !error && (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                No sessions available on master server.
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          {showSuccess ? (
            <button onClick={onClose} className="primary">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="primary"
                disabled={selectedSessionIds.size === 0 || isLoading}
              >
                Import {selectedSessionIds.size} Session
                {selectedSessionIds.size !== 1 ? "s" : ""}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ImportFromNetworkModal;
