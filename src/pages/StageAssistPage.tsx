import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaPlay,
  FaStop,
  FaPlus,
  FaRobot,
  FaTimes,
  FaPaperclip,
  FaPaperPlane,
  FaUpload,
  FaCog,
  FaLink,
} from "react-icons/fa";
import {
  ScheduleItem,
  TimeAdjustmentMode,
} from "../types/propresenter";
import {
  getEnabledConnections,
} from "../services/propresenterService";
import { processAIChatMessage, getAvailableProviders } from "../services/scheduleAIService";
import { formatStageAssistTime, useStageAssist } from "../contexts/StageAssistContext";
import { getAppSettings } from "../utils/aiConfig";
import { AIProvider } from "../types";
import LoadScheduleModal from "../components/LoadScheduleModal";
import AIAssistantSettingsModal, { getAIAssistantSettings } from "../components/AIAssistantSettingsModal";
import RemoteAccessLinkModal from "../components/RemoteAccessLinkModal";
import "../App.css";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

const StageAssistPage: React.FC = () => {
  const {
    timerState,
    setTimerState,
    schedule,
    setSchedule,
    currentSessionIndex,
    setCurrentSessionIndex,
    settings,
    setSettings,
    countdownHours,
    setCountdownHours,
    countdownMinutes,
    setCountdownMinutes,
    countdownSeconds,
    setCountdownSeconds,
    countdownToTime,
    setCountdownToTime,
    countdownToPeriod,
    setCountdownToPeriod,
    startSession,
    startCountdown,
    startCountdownToTime,
    stopTimer,
    getNextSession,
  } = useStageAssist();

  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [nextId, setNextId] = useState(100);

  // AI Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI Provider selection
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | undefined>(undefined);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  
  // AI Assistant Settings Modal
  const [showAISettingsModal, setShowAISettingsModal] = useState(false);
  
  // Initialize available providers and selected provider
  useEffect(() => {
    const providers = getAvailableProviders();
    setAvailableProviders(providers);
    
    if (providers.length > 0) {
      const appSettings = getAppSettings();
      // Use default provider if available, otherwise use first available
      const defaultProvider = appSettings.defaultAIProvider;
      if (defaultProvider && providers.includes(defaultProvider)) {
        setSelectedProvider((prev) => prev || defaultProvider);
      } else {
        setSelectedProvider((prev) => {
          // Only update if current selection is invalid or not set
          if (!prev || !providers.includes(prev)) {
            return providers[0];
          }
          return prev;
        });
      }
    } else {
      setSelectedProvider(undefined);
    }
  }, [showChat]); // Update when chat opens in case settings changed

  // Close provider menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setShowProviderMenu(false);
      }
    };

    if (showProviderMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showProviderMenu]);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // ProPresenter connection count
  const [enabledConnectionsCount, setEnabledConnectionsCount] = useState(0);

  // Load Schedule Modal state
  const [showLoadScheduleModal, setShowLoadScheduleModal] = useState(false);
  
  // Remote Access Link Modal state
  const [showRemoteAccessModal, setShowRemoteAccessModal] = useState(false);

  // Load connection count on mount
  useEffect(() => {
    setEnabledConnectionsCount(getEnabledConnections().length);
  }, []);

  // Keep nextId ahead of any schedule ids (prevents collisions after navigation)
  useEffect(() => {
    const maxId = schedule.reduce((acc, item) => Math.max(acc, item.id), 0);
    setNextId((prev) => (prev <= maxId ? maxId + 1 : prev));
  }, [schedule]);

  // Format countdown inputs on mount to ensure proper display
  useEffect(() => {
    if (countdownHours && !isNaN(parseInt(countdownHours))) {
      const formatted = formatNumberInput(countdownHours, 23);
      if (formatted !== countdownHours) setCountdownHours(formatted);
    }
    if (countdownMinutes && !isNaN(parseInt(countdownMinutes))) {
      const formatted = formatNumberInput(countdownMinutes, 59);
      if (formatted !== countdownMinutes) setCountdownMinutes(formatted);
    }
    if (countdownSeconds && !isNaN(parseInt(countdownSeconds))) {
      const formatted = formatNumberInput(countdownSeconds, 59);
      if (formatted !== countdownSeconds) setCountdownSeconds(formatted);
    }
    if (countdownToTime && !countdownToTime.includes(":")) {
      const formatted = formatTimeInput(countdownToTime);
      if (formatted && formatted !== countdownToTime) setCountdownToTime(formatted);
    }
  }, []); // Only on mount

  // Format time display
  const formatTime = formatStageAssistTime;

  // Format number input to always show two digits
  const formatNumberInput = (value: string, max: number = 59): string => {
    const num = parseInt(value) || 0;
    const clamped = Math.min(Math.max(0, num), max);
    return clamped.toString().padStart(2, "0");
  };

  // Format time input (HH:MM)
  const formatTimeInput = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");
    
    if (digits.length === 0) return "";
    if (digits.length === 1) return digits;
    if (digits.length === 2) return `${digits}:`;
    
    // Format as HH:MM
    const hours = digits.slice(0, 2);
    const minutes = digits.slice(2, 4);
    return `${hours}:${minutes}`;
  };

  // Handle number input change with formatting
  const handleNumberInputChange = (
    value: string,
    setter: (value: string) => void,
    max: number = 59
  ) => {
    // Allow empty string temporarily for better UX
    if (value === "") {
      setter("");
      return;
    }
    // Strip non-digits so we don't accept "e", "+", "-", etc (common with type=number inputs)
    const digitsOnly = value.replace(/[^\d]/g, "");
    if (digitsOnly === "") {
      setter("");
      return;
    }

    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num) && num >= 0) {
      const clamped = Math.min(num, max);
      setter(clamped.toString());
    }
  };

  // Handle time input change with formatting
  const handleTimeInputChange = (value: string) => {
    const formatted = formatTimeInput(value);
    setCountdownToTime(formatted);
  };

  // Calculate duration
  const calculateDuration = (startTime: string, endTime: string): string => {
    const parseTime = (time: string) => {
      const [timeStr, period] = time.split(" ");
      const [hours, minutes] = timeStr.split(":").map(Number);
      const date = new Date();
      date.setHours(period === "PM" && hours !== 12 ? hours + 12 : hours);
      date.setMinutes(minutes);
      return date;
    };

    try {
      const start = parseTime(startTime);
      const end = parseTime(endTime);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60);
      return `${Math.max(0, diff).toString().padStart(2, "0")}mins`;
    } catch {
      return "00mins";
    }
  };

  // Parse duration to seconds
  const parseDurationToSeconds = (durationStr: string): number => {
    const minutes = parseInt(durationStr) || 0;
    return minutes * 60;
  };

  // Start a session timer
  const handleStartSession = async (index: number) => {
    const session = schedule[index];
    const duration = settings.useDurations
      ? parseDurationToSeconds(session.duration)
      : undefined;

    // Calculate end time
    const end = new Date(`${new Date().toDateString()} ${session.endTime}`);
    const now = new Date();
    const timeLeft = duration || Math.floor((end.getTime() - now.getTime()) / 1000);

    // keep UI timer state responsive even if API calls take a moment
    setTimerState({
      isRunning: true,
      timeLeft,
      sessionName: session.session,
      endTime: session.endTime,
      isOverrun: false,
    });
    setCurrentSessionIndex(index);

    const result = await startSession(index);

    if (result.success > 0) {
      showToast(`Timer started on ${result.success} ProPresenter instance(s)`, "success");
    } else if (result.errors.length > 0) {
      showToast(result.errors[0], "error");
    }
  };

  // Start countdown timer
  const handleStartCountdown = async () => {
    const totalSeconds =
      (parseInt(countdownHours || "0", 10) || 0) * 3600 +
      (parseInt(countdownMinutes || "0", 10) || 0) * 60 +
      (parseInt(countdownSeconds || "0", 10) || 0);

    if (totalSeconds <= 0) return;

    const result = await startCountdown(totalSeconds);
    if (result.success > 0) {
      showToast(`Timer started on ${result.success} ProPresenter instance(s)`, "success");
    }
  };

  // Start countdown to time
  const handleStartCountdownToTime = async () => {
    const result = await startCountdownToTime(countdownToTime, countdownToPeriod);
    if (result.success > 0) {
      showToast(`Timer started on ${result.success} ProPresenter instance(s)`, "success");
    }
  };

  // Stop timer
  const handleStopTimer = async () => {
    await stopTimer();
  };

  // Helper to parse duration string to minutes (e.g., "03mins" -> 3)
  const parseDurationToMinutes = (durationStr: string): number => {
    const minutes = parseInt(durationStr.replace("mins", "").trim()) || 0;
    return minutes;
  };

  // Helper to format minutes to duration string (e.g., 3 -> "03mins")
  const formatDuration = (minutes: number): string => {
    return `${Math.max(0, minutes).toString().padStart(2, "0")}mins`;
  };

  // Schedule editing
  const handleEditCell = (id: number, field: string, value: string) => {
    setSchedule((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === id);
      if (currentIndex === -1) return prev;

      // Create a copy of the schedule
      const newSchedule = [...prev];
      const currentItem = { ...newSchedule[currentIndex] };
      
      // Update the current item
      if (field === "startTime" || field === "endTime") {
        let newStartTime = field === "startTime" ? value : currentItem.startTime;
        let newEndTime = field === "endTime" ? value : currentItem.endTime;
        
        // Recalculate duration based on the actual time difference
        // This handles cases where user manually edits both startTime and endTime
        const newDuration = calculateDuration(newStartTime, newEndTime);
        
        // Update the item with new times and recalculated duration
        currentItem.startTime = newStartTime;
        currentItem.endTime = newEndTime;
        currentItem.duration = newDuration;
        newSchedule[currentIndex] = currentItem;
        
        // If editing startTime or endTime, ALWAYS recalculate all subsequent sessions
        if ((field === "startTime" || field === "endTime") && currentIndex < newSchedule.length - 1) {
          try {
            // Start from the next session and cascade through all remaining sessions
            let previousEndTime = newEndTime;
            
            for (let i = currentIndex + 1; i < newSchedule.length; i++) {
              const session = newSchedule[i];
              const durationMinutes = parseDurationToMinutes(session.duration);
              
              // Set start time to previous session's end time
              const newStartTimeForSession = previousEndTime;
              
              // Calculate new end time based on duration
              const newEndTimeForSession = addMinutesToTime(newStartTimeForSession, durationMinutes);
              
              // Update the session
              newSchedule[i] = {
                ...session,
                startTime: newStartTimeForSession,
                endTime: newEndTimeForSession,
                duration: session.duration, // Keep the same duration
              };
              
              // Use this end time as the start time for the next session
              previousEndTime = newEndTimeForSession;
            }
          } catch (error) {
            console.error("Error recalculating schedule times:", error);
          }
        }
      } else if (field === "duration") {
        // When editing duration, recalculate endTime based on startTime + duration
        const minutes = parseDurationToMinutes(value);
        const newEndTime = addMinutesToTime(currentItem.startTime, minutes);
        currentItem.duration = value;
        currentItem.endTime = newEndTime;
        newSchedule[currentIndex] = currentItem;
        
        // ALWAYS recalculate all subsequent sessions when duration (and thus endTime) changes
        if (currentIndex < newSchedule.length - 1) {
          try {
            // Start from the next session and cascade through all remaining sessions
            let previousEndTime = newEndTime;
            
            for (let i = currentIndex + 1; i < newSchedule.length; i++) {
              const session = newSchedule[i];
              const durationMinutes = parseDurationToMinutes(session.duration);
              
              // Set start time to previous session's end time
              const newStartTimeForSession = previousEndTime;
              
              // Calculate new end time based on duration
              const newEndTimeForSession = addMinutesToTime(newStartTimeForSession, durationMinutes);
              
              // Update the session
              newSchedule[i] = {
                ...session,
                startTime: newStartTimeForSession,
                endTime: newEndTimeForSession,
                duration: session.duration, // Keep the same duration
              };
              
              // Use this end time as the start time for the next session
              previousEndTime = newEndTimeForSession;
            }
          } catch (error) {
            console.error("Error recalculating schedule times:", error);
          }
        }
      } else {
        // For other fields (session, minister), just update
        if (field === "session") {
          currentItem.session = value;
        } else if (field === "minister") {
          currentItem.minister = value;
        }
        newSchedule[currentIndex] = currentItem;
      }
      
      return newSchedule;
    });
  };

  const handleAddSession = () => {
    const lastItem = schedule[schedule.length - 1];
    const newItem: ScheduleItem = {
      id: nextId,
      session: "New Session",
      startTime: lastItem?.endTime || "12:00 PM",
      endTime: lastItem?.endTime ? addMinutesToTime(lastItem.endTime, 15) : "12:15 PM",
      duration: "15mins",
    };
    setSchedule([...schedule, newItem]);
    setNextId((prev) => prev + 1);
    setEditingCell({ id: newItem.id, field: "session" });
  };

  const handleDeleteSession = (id: number) => {
    setSchedule((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper to add minutes to time
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [timeStr, period] = time.split(" ");
    const [hours, mins] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(period === "PM" && hours !== 12 ? hours + 12 : hours);
    date.setMinutes(mins + minutes);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // AI Chat handlers
  const handleChatSend = async () => {
    if (!chatInput.trim() && !attachedImage) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      image: attachedImage || undefined,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setAttachedImage(null);
    setIsChatLoading(true);

    try {
      const response = await processAIChatMessage(chatInput, attachedImage || undefined, schedule, selectedProvider);

      // Handle actions
      switch (response.action) {
        case "SetCountDown":
          if (typeof response.actionValue === "number") {
            await startCountdown(response.actionValue);
            showToast(`Timer started for ${Math.floor(response.actionValue / 60)}:${(response.actionValue % 60).toString().padStart(2, "0")}`, "success");
          }
          break;
        case "CountDownToTime":
          if (typeof response.actionValue === "string") {
            await startCountdownToTime(response.actionValue);
            showToast(`Timer set to countdown to ${response.actionValue}`, "success");
          }
          break;
        case "UpdateSchedule":
          if (Array.isArray(response.actionValue)) {
            setSchedule(response.actionValue);
            showToast("Schedule updated from AI", "success");
          }
          break;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.responseText },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error processing your request." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.indexOf("image") === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachedImage(reader.result as string);
            // Use auto-prompt from settings if available, otherwise use default
            const settings = getAIAssistantSettings();
            if (settings.autoPromptForImages) {
              setChatInput(settings.autoPromptForImages);
            } else {
              const currentPeriod = new Date().getHours() >= 12 ? "PM" : "AM";
              setChatInput(
                `Create the schedule based on the provided image. If a time does not specify AM or PM, use ${currentPeriod}.`
              );
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
        // Use auto-prompt from settings if available, otherwise use default
        const settings = getAIAssistantSettings();
        if (settings.autoPromptForImages) {
          setChatInput(settings.autoPromptForImages);
        } else {
          const currentPeriod = new Date().getHours() >= 12 ? "PM" : "AM";
          setChatInput(
            `Create the schedule based on the provided image. If a time does not specify AM or PM, use ${currentPeriod}.`
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const nextSession = getNextSession();
  const nextSessionIndex = currentSessionIndex !== null && nextSession 
    ? schedule.findIndex(s => s.id === nextSession.id)
    : -1;

  return (
    <div
      style={{
        padding: "var(--spacing-4)",
        minHeight: "calc(100vh - 51px)",
        backgroundColor: "var(--app-bg-color)",
        color: "var(--app-text-color)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--spacing-4)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Timer</h1>
        <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
          <button
            onClick={() => setShowLoadScheduleModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: "var(--app-primary-color)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            <FaUpload /> Load Schedule
          </button>
          <button
            onClick={() => setShowRemoteAccessModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: "var(--app-button-bg-color)",
              color: "var(--app-button-text-color)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            <FaLink /> Remote Access Link
          </button>
          {enabledConnectionsCount > 0 && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                backgroundColor: "rgba(34, 197, 94, 0.2)",
                color: "rgb(34, 197, 94)",
              }}
            >
              {enabledConnectionsCount} ProPresenter Connected
            </span>
          )}
        </div>
      </div>

      {/* Timer Displays */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--spacing-4)",
          marginBottom: "var(--spacing-4)",
        }}
      >
        {/* Next Session */}
        <div
          style={{
            backgroundColor: "rgba(255, 162, 0, 0.5)",
            borderRadius: "12px",
            padding: "var(--spacing-6)",
            textAlign: "center",
            color: "white",
          }}
        >
          <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--spacing-2)" }}>NEXT</div>
          {nextSession ? (
            <>
              <div style={{ fontSize: "1.25rem", marginBottom: "var(--spacing-1)" }}>
                {nextSession.session}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{nextSession.startTime}</div>
            </>
          ) : (
            <div style={{ opacity: 0.7 }}>No next session</div>
          )}
        </div>

        {/* Current Timer */}
        <div
          style={{
            backgroundColor: timerState.isOverrun ? "#770a0a" : "rgb(34, 197, 94)",
            borderRadius: "12px",
            padding: "var(--spacing-6)",
            textAlign: "center",
            color: "white",
          }}
        >
          <div style={{ fontSize: "1rem", marginBottom: "var(--spacing-2)" }}>
            {timerState.sessionName || "Timer"}
          </div>
          <div style={{ fontSize: "4rem", fontWeight: 700, fontFamily: "monospace" }}>
            {formatTime(timerState.timeLeft)}
          </div>
          <div style={{ fontSize: "0.875rem", opacity: 0.8 }}>
            {timerState.endTime ? `Until ${timerState.endTime}` : "Current"}
          </div>
        </div>
      </div>

      {/* Timer Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--spacing-4)",
          marginBottom: "var(--spacing-4)",
        }}
      >
        {/* Countdown Timer */}
        <div
          style={{
            backgroundColor: "rgb(29, 78, 216)",
            borderRadius: "12px",
            padding: "var(--spacing-4)",
            color: "white",
          }}
        >
          <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--spacing-3)", textAlign: "center" }}>
            Count Down Timer
          </div>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <label style={{ display: "block", fontSize: "0.8rem", opacity: 0.95, fontWeight: 600, marginBottom: "6px" }}>Hours</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={countdownHours}
                onChange={(e) => handleNumberInputChange(e.target.value, setCountdownHours, 23)}
                onBlur={(e) => {
                  const formatted = formatNumberInput(e.target.value || "0", 23);
                  setCountdownHours(formatted);
                }}
                className="countdown-input"
                style={{
                  width: "92px",
                  height: "58px",
                  textAlign: "center",
                  fontSize: "1.6rem",
                  lineHeight: "58px",
                  padding: "0",
                  fontWeight: 600,
                  border: "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <span style={{ fontSize: "1.5rem", paddingTop: "20px", fontWeight: 700 }}>:</span>
            <div style={{ textAlign: "center" }}>
              <label style={{ display: "block", fontSize: "0.8rem", opacity: 0.95, fontWeight: 600, marginBottom: "6px" }}>Minutes</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={countdownMinutes}
                onChange={(e) => handleNumberInputChange(e.target.value, setCountdownMinutes, 59)}
                onBlur={(e) => {
                  const formatted = formatNumberInput(e.target.value || "0", 59);
                  setCountdownMinutes(formatted);
                }}
                className="countdown-input"
                style={{
                  width: "92px",
                  height: "58px",
                  textAlign: "center",
                  fontSize: "1.6rem",
                  lineHeight: "58px",
                  padding: "0",
                  fontWeight: 600,
                  border: "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <span style={{ fontSize: "1.5rem", paddingTop: "20px", fontWeight: 700 }}>:</span>
            <div style={{ textAlign: "center" }}>
              <label style={{ display: "block", fontSize: "0.8rem", opacity: 0.95, fontWeight: 600, marginBottom: "6px" }}>Seconds</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={countdownSeconds}
                onChange={(e) => handleNumberInputChange(e.target.value, setCountdownSeconds, 59)}
                onBlur={(e) => {
                  const formatted = formatNumberInput(e.target.value || "0", 59);
                  setCountdownSeconds(formatted);
                }}
                className="countdown-input"
                style={{
                  width: "92px",
                  height: "58px",
                  textAlign: "center",
                  fontSize: "1.6rem",
                  lineHeight: "58px",
                  padding: "0",
                  fontWeight: 600,
                  border: "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-2)", marginLeft: "var(--spacing-4)" }}>
              <button
                onClick={handleStartCountdown}
                style={{
                  padding: "var(--spacing-2) var(--spacing-4)",
                  backgroundColor: "rgb(34, 197, 94)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <FaPlay style={{ marginRight: "4px" }} /> Start
              </button>
              <button
                onClick={handleStopTimer}
                style={{
                  padding: "var(--spacing-2) var(--spacing-4)",
                  backgroundColor: "rgb(153, 27, 27)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <FaStop style={{ marginRight: "4px" }} /> Stop
              </button>
            </div>
          </div>
        </div>

        {/* Countdown to Time */}
        <div
          style={{
            backgroundColor: "rgb(29, 78, 216)",
            borderRadius: "12px",
            padding: "var(--spacing-4)",
            color: "white",
          }}
        >
          <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--spacing-3)", textAlign: "center" }}>
            Count Down to Time
          </div>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <label style={{ display: "block", fontSize: "0.8rem", opacity: 0.95, fontWeight: 600, marginBottom: "6px" }}>Time</label>
              <input
                type="text"
                value={countdownToTime}
                onChange={(e) => handleTimeInputChange(e.target.value)}
                onBlur={(e) => {
                  // Ensure proper format on blur
                  const value = e.target.value.trim();
                  if (value && !value.includes(":")) {
                    // If user typed digits without colon, format it
                    const formatted = formatTimeInput(value);
                    setCountdownToTime(formatted || "7:30");
                  } else if (!value) {
                    setCountdownToTime("7:30");
                  }
                }}
                placeholder="7:30"
                className="countdown-input"
                style={{
                  width: "128px",
                  height: "58px",
                  textAlign: "center",
                  fontSize: "1.6rem",
                  lineHeight: "58px",
                  padding: "0",
                  fontWeight: 600,
                  border: "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <label style={{ display: "block", fontSize: "0.8rem", opacity: 0.95, fontWeight: 600, marginBottom: "6px" }}>Period</label>
              <select
                value={countdownToPeriod}
                onChange={(e) => setCountdownToPeriod(e.target.value as "AM" | "PM")}
                className="countdown-input"
                style={{
                  width: "104px",
                  height: "58px",
                  textAlign: "center",
                  fontSize: "1.6rem",
                  lineHeight: "58px",
                  padding: "0 34px 0 14px",
                  fontWeight: 600,
                  border: "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  fontFamily: "monospace",
                  cursor: "pointer",
                }}
              >
                <option value="AM" style={{ backgroundColor: "rgb(29, 78, 216)", color: "#ffffff" }}>AM</option>
                <option value="PM" style={{ backgroundColor: "rgb(29, 78, 216)", color: "#ffffff" }}>PM</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-2)", marginLeft: "var(--spacing-4)" }}>
              <button
                onClick={handleStartCountdownToTime}
                style={{
                  padding: "var(--spacing-2) var(--spacing-4)",
                  backgroundColor: "rgb(34, 197, 94)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <FaPlay style={{ marginRight: "4px" }} /> Start
              </button>
              <button
                onClick={handleStopTimer}
                style={{
                  padding: "var(--spacing-2) var(--spacing-4)",
                  backgroundColor: "rgb(153, 27, 27)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <FaStop style={{ marginRight: "4px" }} /> Stop
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div
        style={{
          backgroundColor: "var(--app-header-bg)",
          borderRadius: "12px",
          border: "1px solid var(--app-border-color)",
          marginBottom: "var(--spacing-4)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
              <th style={{ padding: "var(--spacing-3)", textAlign: "left", fontWeight: 600 }}>Session</th>
              <th style={{ padding: "var(--spacing-3)", textAlign: "left", fontWeight: 600 }}>Time</th>
              <th style={{ padding: "var(--spacing-3)", textAlign: "left", fontWeight: 600 }}>Duration</th>
              <th style={{ padding: "var(--spacing-3)", textAlign: "left", fontWeight: 600 }}>Minister</th>
              <th style={{ padding: "var(--spacing-3)", textAlign: "center", fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((item, index) => (
              <tr
                key={item.id}
                style={{
                  backgroundColor:
                    currentSessionIndex === index
                      ? "rgba(34, 197, 94, 0.2)"
                      : nextSessionIndex === index
                      ? "rgba(249, 115, 22, 0.15)"
                      : "transparent",
                  borderBottom: "1px solid var(--app-border-color)",
                }}
              >
                <td style={{ padding: "var(--spacing-3)" }}>
                  {editingCell?.id === item.id && editingCell.field === "session" ? (
                    <input
                      type="text"
                      value={item.session}
                      onChange={(e) => handleEditCell(item.id, "session", e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingCell(null)}
                      autoFocus
                      style={{
                        padding: "var(--spacing-2)",
                        borderRadius: "4px",
                        border: "1px solid var(--app-border-color)",
                        backgroundColor: "var(--app-input-bg-color)",
                        color: "var(--app-input-text-color)",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingCell({ id: item.id, field: "session" })}
                      style={{ cursor: "pointer" }}
                    >
                      {item.session}
                    </span>
                  )}
                </td>
                <td style={{ padding: "var(--spacing-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
                    {editingCell?.id === item.id && editingCell.field === "startTime" ? (
                      <input
                        type="text"
                        value={item.startTime}
                        onChange={(e) => handleEditCell(item.id, "startTime", e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        style={{
                          padding: "var(--spacing-1)",
                          borderRadius: "4px",
                          border: "1px solid var(--app-border-color)",
                          backgroundColor: "var(--app-input-bg-color)",
                          color: "var(--app-input-text-color)",
                          width: "100px",
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ id: item.id, field: "startTime" })}
                        style={{ cursor: "pointer" }}
                      >
                        {item.startTime}
                      </span>
                    )}
                    <span>-</span>
                    {editingCell?.id === item.id && editingCell.field === "endTime" ? (
                      <input
                        type="text"
                        value={item.endTime}
                        onChange={(e) => handleEditCell(item.id, "endTime", e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        style={{
                          padding: "var(--spacing-1)",
                          borderRadius: "4px",
                          border: "1px solid var(--app-border-color)",
                          backgroundColor: "var(--app-input-bg-color)",
                          color: "var(--app-input-text-color)",
                          width: "100px",
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ id: item.id, field: "endTime" })}
                        style={{ cursor: "pointer" }}
                      >
                        {item.endTime}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "var(--spacing-3)" }}>
                  {editingCell?.id === item.id && editingCell.field === "duration" ? (
                    <input
                      type="text"
                      value={item.duration}
                      onChange={(e) => handleEditCell(item.id, "duration", e.target.value)}
                      onBlur={() => {
                        // Ensure duration is properly formatted on blur
                        const currentItem = schedule.find((s) => s.id === item.id);
                        if (currentItem) {
                          const minutes = parseDurationToMinutes(currentItem.duration);
                          const formatted = formatDuration(minutes);
                          if (formatted !== currentItem.duration) {
                            handleEditCell(item.id, "duration", formatted);
                          }
                        }
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const currentItem = schedule.find((s) => s.id === item.id);
                          if (currentItem) {
                            const minutes = parseDurationToMinutes(currentItem.duration);
                            const formatted = formatDuration(minutes);
                            if (formatted !== currentItem.duration) {
                              handleEditCell(item.id, "duration", formatted);
                            }
                          }
                          setEditingCell(null);
                        }
                      }}
                      autoFocus
                      style={{
                        padding: "var(--spacing-1)",
                        borderRadius: "4px",
                        border: "1px solid var(--app-border-color)",
                        backgroundColor: "var(--app-input-bg-color)",
                        color: "var(--app-input-text-color)",
                        width: "80px",
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingCell({ id: item.id, field: "duration" })}
                      style={{ cursor: "pointer" }}
                    >
                      {item.duration}
                    </span>
                  )}
                </td>
                <td style={{ padding: "var(--spacing-3)" }}>
                  {editingCell?.id === item.id && editingCell.field === "minister" ? (
                    <input
                      type="text"
                      value={item.minister || ""}
                      onChange={(e) => handleEditCell(item.id, "minister", e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      autoFocus
                      style={{
                        padding: "var(--spacing-1)",
                        borderRadius: "4px",
                        border: "1px solid var(--app-border-color)",
                        backgroundColor: "var(--app-input-bg-color)",
                        color: "var(--app-input-text-color)",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingCell({ id: item.id, field: "minister" })}
                      style={{ cursor: "pointer", opacity: item.minister ? 1 : 0.5 }}
                    >
                      {item.minister || "Click to add"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "var(--spacing-3)", textAlign: "center" }}>
                  <div style={{ display: "flex", gap: "var(--spacing-2)", justifyContent: "center" }}>
                    <button
                      onClick={() => handleStartSession(index)}
                      style={{
                        padding: "var(--spacing-2) var(--spacing-3)",
                        backgroundColor: "rgb(29, 78, 216)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: "0.875rem",
                      }}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleDeleteSession(item.id)}
                      style={{
                        padding: "var(--spacing-2) var(--spacing-3)",
                        backgroundColor: "rgb(153, 27, 27)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: "0.875rem",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "var(--spacing-3)" }}>
          <button onClick={handleAddSession} className="secondary">
            <FaPlus style={{ marginRight: "var(--spacing-1)" }} /> Add New Session
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "var(--spacing-3)", flexWrap: "wrap", marginBottom: "var(--spacing-4)" }}>
        <button
          onClick={() => setSettings((s) => ({ ...s, isAutoPlay: !s.isAutoPlay }))}
          style={{
            padding: "var(--spacing-2) var(--spacing-4)",
            backgroundColor: settings.isAutoPlay ? "rgb(34, 197, 94)" : "rgb(29, 78, 216)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Auto Play: {settings.isAutoPlay ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => {
            setSettings((s) => ({
              ...s,
              isAllowOverrun: !s.isAllowOverrun,
              isAutoPlay: !s.isAllowOverrun ? false : s.isAutoPlay,
            }));
          }}
          style={{
            padding: "var(--spacing-2) var(--spacing-4)",
            backgroundColor: settings.isAllowOverrun ? "rgb(34, 197, 94)" : "rgb(29, 78, 216)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Allow Overrun: {settings.isAllowOverrun ? "ON" : "OFF"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
          <span style={{ fontSize: "0.875rem" }}>Dynamic Time Adjustment:</span>
          <select
            value={settings.timeAdjustmentMode}
            onChange={(e) =>
              setSettings((s) => ({ ...s, timeAdjustmentMode: e.target.value as TimeAdjustmentMode }))
            }
            style={{
              padding: "var(--spacing-2)",
              borderRadius: "6px",
              border: "1px solid var(--app-border-color)",
              backgroundColor: "var(--app-input-bg-color)",
              color: "var(--app-input-text-color)",
            }}
          >
            <option value="NONE">No Adjustment</option>
            <option value="EARLY_END">Early End Only</option>
            <option value="OVERRUN">Overrun Only</option>
            <option value="BOTH">Both Early & Overrun</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-1)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.useDurations}
            onChange={(e) => setSettings((s) => ({ ...s, useDurations: e.target.checked }))}
            style={{ width: "18px", height: "18px" }}
          />
          <span style={{ fontSize: "0.875rem" }}>Use Durations</span>
        </label>
      </div>

      {/* AI Chat Window */}
      {showChat && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            right: "20px",
            width: "400px",
            maxHeight: "500px",
            backgroundColor: "var(--app-bg-color)",
            borderRadius: "12px",
            border: "1px solid var(--app-border-color)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--spacing-3)",
              borderBottom: "1px solid var(--app-border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", flex: 1 }}>
              <span style={{ fontWeight: 600 }}>AI Assistant</span>
              {selectedProvider && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-1)" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    {selectedProvider === "openai" ? "OpenAI" : selectedProvider === "groq" ? "Groq" : "Gemini"}
                  </span>
                  {availableProviders.length > 1 && (
                    <div style={{ position: "relative" }} ref={providerMenuRef}>
                      <button
                        onClick={() => setShowProviderMenu(!showProviderMenu)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--app-text-color-secondary)",
                          cursor: "pointer",
                          padding: "2px 4px",
                          fontSize: "0.75rem",
                        }}
                        title="Switch provider"
                      >
                        ▼
                      </button>
                      {showProviderMenu && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: "4px",
                            backgroundColor: "var(--app-header-bg)",
                            border: "1px solid var(--app-border-color)",
                            borderRadius: "6px",
                            padding: "var(--spacing-1)",
                            minWidth: "120px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            zIndex: 1001,
                          }}
                        >
                          {availableProviders.map((provider) => (
                            <button
                              key={provider}
                              onClick={() => {
                                setSelectedProvider(provider);
                                setShowProviderMenu(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "var(--spacing-2)",
                                textAlign: "left",
                                background: provider === selectedProvider ? "var(--app-primary-color)" : "transparent",
                                color: provider === selectedProvider ? "white" : "var(--app-text-color)",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                              }}
                            >
                              {provider === "openai" ? "OpenAI" : provider === "groq" ? "Groq" : "Gemini"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowAISettingsModal(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--app-text-color-secondary)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "0.875rem",
                    }}
                    title="AI Assistant Settings"
                  >
                    <FaCog />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowChat(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--app-text-color)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--spacing-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-2)",
              maxHeight: "300px",
            }}
          >
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", opacity: 0.6, padding: "var(--spacing-4)" }}>
                <FaRobot style={{ fontSize: "2rem", marginBottom: "var(--spacing-2)" }} />
                <p>Paste a schedule image or type a command</p>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  padding: "var(--spacing-2) var(--spacing-3)",
                  borderRadius: "12px",
                  backgroundColor: msg.role === "user" ? "rgb(29, 78, 216)" : "var(--app-header-bg)",
                  color: msg.role === "user" ? "white" : "var(--app-text-color)",
                }}
              >
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Attached"
                    style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "8px", marginBottom: "var(--spacing-2)" }}
                  />
                )}
                <p style={{ margin: 0, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{msg.content}</p>
              </div>
            ))}
            {isChatLoading && (
              <div style={{ opacity: 0.6, fontSize: "0.875rem" }}>Thinking...</div>
            )}
          </div>

          {/* Chat Input */}
          <div style={{ padding: "var(--spacing-3)", borderTop: "1px solid var(--app-border-color)" }}>
            {attachedImage && (
              <div style={{ position: "relative", marginBottom: "var(--spacing-2)" }}>
                <img
                  src={attachedImage}
                  alt="Attached"
                  style={{ maxHeight: "100px", borderRadius: "8px" }}
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "rgba(0,0,0,0.5)",
                    border: "none",
                    borderRadius: "50%",
                    color: "white",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                  }}
                >
                  <FaTimes />
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
              <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--app-text-color)",
                  cursor: "pointer",
                  padding: "var(--spacing-2)",
                }}
              >
                <FaPaperclip />
              </button>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handleImagePaste}
                placeholder="Type a message or paste an image..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "var(--spacing-2)",
                  borderRadius: "8px",
                  border: "1px solid var(--app-border-color)",
                  backgroundColor: "var(--app-input-bg-color)",
                  color: "var(--app-input-text-color)",
                  resize: "none",
                  minHeight: "60px",
                }}
              />
              <button
                onClick={handleChatSend}
                disabled={isChatLoading || (!chatInput.trim() && !attachedImage)}
                style={{
                  padding: "var(--spacing-2)",
                  backgroundColor: "rgb(29, 78, 216)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  opacity: isChatLoading || (!chatInput.trim() && !attachedImage) ? 0.5 : 1,
                }}
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant FAB */}
      <button
        onClick={() => setShowChat(!showChat)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-2)",
          padding: "var(--spacing-3) var(--spacing-4)",
          backgroundColor: "rgb(29, 78, 216)",
          color: "white",
          border: "none",
          borderRadius: "30px",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          fontWeight: 600,
          zIndex: 999,
        }}
      >
        <FaRobot />
        AI Assistant
      </button>

      {/* Toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "var(--spacing-3) var(--spacing-5)",
            borderRadius: "8px",
            backgroundColor:
              toast.type === "success"
                ? "rgb(34, 197, 94)"
                : toast.type === "error"
                ? "rgb(220, 38, 38)"
                : "rgb(59, 130, 246)",
            color: "white",
            fontWeight: 500,
            cursor: "pointer",
            zIndex: 1001,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Load Schedule Modal */}
      <LoadScheduleModal
        isOpen={showLoadScheduleModal}
        onClose={() => setShowLoadScheduleModal(false)}
        onScheduleLoad={(newSchedule) => {
          setSchedule(newSchedule);
          setShowLoadScheduleModal(false);
        }}
      />

      {/* AI Assistant Settings Modal */}
      <AIAssistantSettingsModal
        isOpen={showAISettingsModal}
        onClose={() => setShowAISettingsModal(false)}
      />

      {/* Remote Access Link Modal */}
      <RemoteAccessLinkModal
        isOpen={showRemoteAccessModal}
        onClose={() => setShowRemoteAccessModal(false)}
      />
    </div>
  );
};

export default StageAssistPage;
