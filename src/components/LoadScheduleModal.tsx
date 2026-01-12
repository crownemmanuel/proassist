import React, { useState, useRef } from "react";
import { ScheduleItem } from "../types/propresenter";
import ConfirmDialog from "./ConfirmDialog";
import "../App.css";

interface LoadScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleLoad: (schedule: ScheduleItem[]) => void;
}

const LoadScheduleModal: React.FC<LoadScheduleModalProps> = ({
  isOpen,
  onClose,
  onScheduleLoad,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processScheduleFile = async (file: File) => {
    try {
      setError(null);
      const text = await file.text();
      const rows = text.split("\n").filter((row) => row.trim()); // Remove empty rows
      
      if (rows.length === 0) {
        throw new Error("File is empty");
      }

      const headers = rows[0].split(",").map((h) => h.trim().toUpperCase());

      // Check for required columns (flexible - check for variations)
      const hasSession = headers.some((h) => h.includes("SESSION") || h.includes("EVENT"));
      const hasTime = headers.some((h) => h.includes("TIME"));
      const hasDuration = headers.some((h) => h.includes("DURATION"));

      if (!hasSession || !hasTime || !hasDuration) {
        throw new Error(
          "Invalid CSV format. Required columns: SESSION (or EVENT), TIME, DURATION"
        );
      }

      // Find column indices
      const sessionIndex = headers.findIndex((h) => h.includes("SESSION") || h.includes("EVENT"));
      const timeIndex = headers.findIndex((h) => h.includes("TIME"));
      const durationIndex = headers.findIndex((h) => h.includes("DURATION"));
      const ministerIndex = headers.findIndex((h) => h.includes("MINISTER"));

      const schedule: ScheduleItem[] = rows
        .slice(1) // Skip header row
        .filter((row) => row.trim()) // Skip empty rows
        .map((row, index) => {
          const columns = row.split(",").map((c) => c.trim());
          
          const session = columns[sessionIndex] || `Session ${index + 1}`;
          const timeRange = columns[timeIndex] || "";
          const duration = columns[durationIndex] || "00mins";
          const minister = ministerIndex >= 0 ? (columns[ministerIndex] || "") : "";

          // Parse time range - handle formats like "06.00-08.02" or "6:00 AM - 8:02 AM" or "10:30 AM - 10:32 AM"
          let startTime = "";
          let endTime = "";

          if (timeRange.includes("-")) {
            const [startStr, endStr] = timeRange.split("-").map((s) => s.trim());
            
            // Check if it's in format "06.00" or "6:00 AM"
            if (startStr.includes(".")) {
              // Format: "06.00"
              const [startHour, startMin] = startStr.split(".");
              const [endHour, endMin] = endStr.split(".");
              
              // Get current system time period (AM/PM)
              const currentPeriod = new Date().getHours() >= 12 ? "PM" : "AM";
              
              startTime = `${parseInt(startHour)}:${startMin.padStart(2, "0")} ${currentPeriod}`;
              endTime = `${parseInt(endHour)}:${endMin.padStart(2, "0")} ${currentPeriod}`;
            } else {
              // Format: "10:30 AM" or "10:30 AM - 10:32 AM"
              startTime = startStr;
              endTime = endStr;
            }
          } else {
            // If no range, try to parse as single time
            const currentPeriod = new Date().getHours() >= 12 ? "PM" : "AM";
            startTime = timeRange || `12:00 ${currentPeriod}`;
            // Default to 15 minutes later if no end time
            const [hours, minutes] = (timeRange || "12:00").split(":").map(Number);
            const endDate = new Date();
            endDate.setHours(hours || 12);
            endDate.setMinutes((minutes || 0) + 15);
            endTime = endDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          }

          return {
            id: index + 1,
            session,
            startTime,
            endTime,
            duration: duration.includes("mins") ? duration : `${duration}mins`,
            ...(minister && { minister }),
          };
        });

      if (schedule.length === 0) {
        throw new Error("No valid schedule items found in file");
      }

      onScheduleLoad(schedule);
      setShowConfirm(false);
      onClose();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Show success message
      alert(`Successfully loaded ${schedule.length} schedule items`);
    } catch (error) {
      console.error("Error loading schedule:", error);
      setError(error instanceof Error ? error.message : "Failed to load schedule");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    if (selectedFile) {
      processScheduleFile(selectedFile);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div className="modal-content" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
          <h2 style={{ marginTop: 0 }}>Load Schedule</h2>
          <p style={{ marginTop: 4, marginBottom: "var(--spacing-4)" }}>
            Load a schedule from a CSV file. This will replace the current schedule.
            <br />
            <strong>Required columns:</strong> SESSION (or EVENT), TIME, DURATION
            <br />
            <strong>Optional columns:</strong> MINISTER
          </p>
          
          {error && (
            <div
              style={{
                padding: "var(--spacing-3)",
                backgroundColor: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: "6px",
                color: "rgb(220, 38, 38)",
                marginBottom: "var(--spacing-4)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              style={{
                width: "100%",
                padding: "var(--spacing-2)",
                borderRadius: "6px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-input-bg-color)",
                color: "var(--app-input-text-color)",
              }}
            />
          </div>

          <div className="modal-actions">
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Replace Current Schedule?"
        message={`This will replace your current schedule with the contents of ${selectedFile?.name}. This action cannot be undone.`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export default LoadScheduleModal;
