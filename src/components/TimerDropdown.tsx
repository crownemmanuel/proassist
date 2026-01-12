import React, { useState, useRef, useEffect } from "react";
import { FaClock, FaChevronDown, FaTimes } from "react-icons/fa";
import { useStageAssist } from "../contexts/StageAssistContext";
import { ScheduleItem } from "../types/propresenter";
import "../App.css";

interface TimerDropdownProps {
  slideId: string;
  selectedSessionIndex: number | undefined;
  onSelectSession: (sessionIndex: number | undefined) => void;
  disabled?: boolean;
}

const TimerDropdown: React.FC<TimerDropdownProps> = ({
  slideId,
  selectedSessionIndex,
  onSelectSession,
  disabled = false,
}) => {
  const { schedule } = useStageAssist();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const selectedSession =
    selectedSessionIndex !== undefined
      ? schedule[selectedSessionIndex]
      : null;

  const handleSelect = (index: number | undefined) => {
    onSelectSession(index);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect(undefined);
  };

  if (schedule.length === 0) {
    return null; // Don't show dropdown if no schedule items
  }

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="secondary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          fontSize: "0.85em",
          position: "relative",
          minWidth: "140px",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
        title={
          selectedSession
            ? `Timer: ${selectedSession.session}`
            : "Select timer session to trigger on Go Live"
        }
      >
        <FaClock
          style={{
            fontSize: "0.9em",
            opacity: selectedSession ? 1 : 0.6,
            color: selectedSession ? "#3b82f6" : "inherit",
          }}
        />
        <span
          style={{
            flex: 1,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedSession
            ? selectedSession.session
            : "Timer"}
        </span>
        {selectedSession && !disabled && (
          <FaTimes
            onClick={handleClear}
            style={{
              fontSize: "0.75em",
              opacity: 0.7,
              cursor: "pointer",
              padding: "2px",
            }}
            title="Clear timer selection"
          />
        )}
        {!selectedSession && (
          <FaChevronDown
            style={{
              fontSize: "0.75em",
              opacity: 0.6,
            }}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "var(--app-bg-color)",
            border: "1px solid var(--app-border-color)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
            minWidth: "200px",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: "0.85em",
              color: "var(--app-text-color-secondary)",
              borderBottom: "1px solid var(--app-border-color)",
              fontWeight: 600,
            }}
          >
            Select Timer Session
          </div>
          <div
            onClick={() => handleSelect(undefined)}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: "0.9em",
              borderBottom: "1px solid var(--app-border-color)",
              backgroundColor:
                selectedSessionIndex === undefined
                  ? "var(--app-header-bg)"
                  : "transparent",
              color:
                selectedSessionIndex === undefined
                  ? "var(--app-text-color)"
                  : "var(--app-text-color-secondary)",
            }}
            onMouseEnter={(e) => {
              if (selectedSessionIndex !== undefined) {
                e.currentTarget.style.backgroundColor = "var(--app-header-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSessionIndex !== undefined) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <span style={{ opacity: 0.7 }}>None</span>
          </div>
          {schedule.map((session: ScheduleItem, index: number) => (
            <div
              key={session.id}
              onClick={() => handleSelect(index)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: "0.9em",
                borderBottom:
                  index < schedule.length - 1
                    ? "1px solid var(--app-border-color)"
                    : "none",
                backgroundColor:
                  selectedSessionIndex === index
                    ? "var(--app-header-bg)"
                    : "transparent",
                color:
                  selectedSessionIndex === index
                    ? "var(--app-text-color)"
                    : "var(--app-text-color-secondary)",
              }}
              onMouseEnter={(e) => {
                if (selectedSessionIndex !== index) {
                  e.currentTarget.style.backgroundColor = "var(--app-header-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSessionIndex !== index) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <div
                style={{
                  fontWeight: selectedSessionIndex === index ? 600 : 400,
                  marginBottom: "2px",
                }}
              >
                {session.session}
              </div>
              <div
                style={{
                  fontSize: "0.85em",
                  opacity: 0.7,
                  display: "flex",
                  gap: "8px",
                }}
              >
                <span>{session.startTime}</span>
                {session.endTime && (
                  <>
                    <span>→</span>
                    <span>{session.endTime}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimerDropdown;
