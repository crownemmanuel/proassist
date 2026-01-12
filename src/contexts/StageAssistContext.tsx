import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ScheduleItem, TimerState, TimeAdjustmentMode } from "../types/propresenter";
import { startTimerOnAllEnabled, stopTimerOnAllEnabled } from "../services/propresenterService";

// Storage keys
const SCHEDULE_STORAGE_KEY = "proassist-stage-assist-schedule";
const SETTINGS_STORAGE_KEY = "proassist-stage-assist-settings";
const RUNTIME_STORAGE_KEY = "proassist-stage-assist-runtime";

export interface StageAssistSettings {
  timeAdjustmentMode: TimeAdjustmentMode;
  useDurations: boolean;
  isAutoPlay: boolean;
  isAllowOverrun: boolean;
}

const defaultSchedule: ScheduleItem[] = [
  {
    id: 1,
    session: "Opening Prayer",
    startTime: "10:30 AM",
    endTime: "10:32 AM",
    duration: "02mins",
  },
  {
    id: 2,
    session: "Worship & Praise",
    startTime: "10:32 AM",
    endTime: "10:45 AM",
    duration: "13mins",
    minister: "worship team",
  },
  {
    id: 3,
    session: "Call to Worship (Psalm 3)",
    startTime: "10:45 AM",
    endTime: "10:48 AM",
    duration: "03mins",
  },
];

const defaultSettings: StageAssistSettings = {
  timeAdjustmentMode: "NONE",
  useDurations: false,
  isAutoPlay: false,
  isAllowOverrun: false,
};

export function formatStageAssistTime(seconds: number) {
  const isNegative = seconds < 0;
  const absoluteSeconds = Math.abs(seconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;
  return `${isNegative ? "-" : ""}${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function parseDurationToSeconds(durationStr: string): number {
  const minutes = parseInt(durationStr) || 0;
  return minutes * 60;
}

type StageAssistContextValue = {
  // persisted user data
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
  settings: StageAssistSettings;
  setSettings: React.Dispatch<React.SetStateAction<StageAssistSettings>>;

  // runtime state
  timerState: TimerState;
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>;
  currentSessionIndex: number | null;
  setCurrentSessionIndex: React.Dispatch<React.SetStateAction<number | null>>;

  // countdown controls
  countdownHours: string;
  setCountdownHours: React.Dispatch<React.SetStateAction<string>>;
  countdownMinutes: string;
  setCountdownMinutes: React.Dispatch<React.SetStateAction<string>>;
  countdownSeconds: string;
  setCountdownSeconds: React.Dispatch<React.SetStateAction<string>>;
  countdownToTime: string;
  setCountdownToTime: React.Dispatch<React.SetStateAction<string>>;
  countdownToPeriod: "AM" | "PM";
  setCountdownToPeriod: React.Dispatch<React.SetStateAction<"AM" | "PM">>;

  // actions
  startSession: (index: number) => Promise<{ success: number; failed: number; errors: string[] }>;
  startCountdown: (totalSeconds?: number) => Promise<{ success: number; failed: number; errors: string[] }>;
  startCountdownToTime: (
    time?: string,
    period?: "AM" | "PM"
  ) => Promise<{ success: number; failed: number; errors: string[] }>;
  stopTimer: () => Promise<{ success: number; failed: number }>;
  getNextSession: () => ScheduleItem | null;
  goNextSession: () => Promise<boolean>;
};

const StageAssistContext = createContext<StageAssistContextValue | null>(null);

export const StageAssistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [settings, setSettings] = useState<StageAssistSettings>(defaultSettings);

  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    timeLeft: 0,
    sessionName: "",
    endTime: "",
    isOverrun: false,
  });
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number | null>(null);

  const [countdownHours, setCountdownHours] = useState("0");
  const [countdownMinutes, setCountdownMinutes] = useState("5");
  const [countdownSeconds, setCountdownSeconds] = useState("0");
  const [countdownToTime, setCountdownToTime] = useState("7:30");
  const [countdownToPeriod, setCountdownToPeriod] = useState<"AM" | "PM">("PM");

  // Load persisted schedule/settings on mount
  useEffect(() => {
    try {
      const savedSchedule = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (savedSchedule) {
        setSchedule(JSON.parse(savedSchedule));
      } else {
        setSchedule(defaultSchedule);
      }
    } catch (error) {
      console.error("Error loading schedule from localStorage:", error);
      setSchedule(defaultSchedule);
    }

    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Error loading settings from localStorage:", error);
      // Keep default settings
    }

    // Restore runtime timer state so it survives navigation (and even app reload)
    const savedRuntime = localStorage.getItem(RUNTIME_STORAGE_KEY);
    if (savedRuntime) {
      try {
        const parsed = JSON.parse(savedRuntime) as { timerState: TimerState; savedAt: number; currentSessionIndex: number | null };
        const elapsed = Math.floor((Date.now() - parsed.savedAt) / 1000);
        const restoredTimeLeft = parsed.timerState.isRunning ? parsed.timerState.timeLeft - elapsed : parsed.timerState.timeLeft;
        setTimerState({
          ...parsed.timerState,
          timeLeft: restoredTimeLeft,
          isOverrun: restoredTimeLeft < 0,
        });
        setCurrentSessionIndex(parsed.currentSessionIndex ?? null);
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist schedule/settings
  useEffect(() => {
    if (schedule.length > 0) {
      try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
      } catch (error) {
        console.error("Error saving schedule to localStorage:", error);
      }
    }
  }, [schedule]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  }, [settings]);

  // Persist runtime timer state (for navigation + reload safety)
  useEffect(() => {
    localStorage.setItem(
      RUNTIME_STORAGE_KEY,
      JSON.stringify({ timerState, currentSessionIndex, savedAt: Date.now() })
    );
  }, [timerState, currentSessionIndex]);

  // Countdown ticking (lives at app level so it survives route changes)
  const tickIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!timerState.isRunning) {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    if (tickIntervalRef.current) return;

    tickIntervalRef.current = window.setInterval(() => {
      setTimerState((prev) => {
        if (!prev.isRunning) return prev;
        const newTimeLeft = prev.timeLeft - 1;
        return {
          ...prev,
          timeLeft: newTimeLeft,
          isOverrun: newTimeLeft < 0,
        };
      });
    }, 1000);

    return () => {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [timerState.isRunning]);

  const startSession = useCallback(
    async (index: number) => {
      const session = schedule[index];
      if (!session) return { success: 0, failed: 0, errors: [] };

      const duration = settings.useDurations ? parseDurationToSeconds(session.duration) : undefined;
      const end = new Date(`${new Date().toDateString()} ${session.endTime}`);
      const now = new Date();
      const timeLeft = duration || Math.floor((end.getTime() - now.getTime()) / 1000);

      setTimerState({
        isRunning: true,
        timeLeft,
        sessionName: session.session,
        endTime: session.endTime,
        isOverrun: false,
      });
      setCurrentSessionIndex(index);

      return await startTimerOnAllEnabled(session.session, duration, settings.useDurations ? undefined : session.endTime);
    },
    [schedule, settings.useDurations]
  );

  // Auto-play next session (runs at app level so it survives navigation)
  useEffect(() => {
    if (
      timerState.timeLeft === 0 &&
      settings.isAutoPlay &&
      !settings.isAllowOverrun &&
      timerState.isRunning
    ) {
      const nextIndex = currentSessionIndex !== null ? currentSessionIndex + 1 : 0;
      if (nextIndex < schedule.length) {
        // best-effort; ignore failures
        void startSession(nextIndex);
      }
    }
  }, [
    timerState.timeLeft,
    timerState.isRunning,
    settings.isAutoPlay,
    settings.isAllowOverrun,
    currentSessionIndex,
    schedule.length,
    startSession,
  ]);

  const startCountdown = useCallback(
    async (totalSeconds?: number) => {
      const computed =
        totalSeconds ??
        parseInt(countdownHours) * 3600 +
          parseInt(countdownMinutes) * 60 +
          parseInt(countdownSeconds);
      if (!computed || computed <= 0) return { success: 0, failed: 0, errors: [] };

      setTimerState({
        isRunning: true,
        timeLeft: computed,
        sessionName: "Countdown",
        endTime: "",
        isOverrun: false,
      });
      setCurrentSessionIndex(null);

      return await startTimerOnAllEnabled("Countdown", computed);
    },
    [countdownHours, countdownMinutes, countdownSeconds]
  );

  const startCountdownToTime = useCallback(
    async (time?: string, period?: "AM" | "PM") => {
      const finalTime = time ?? countdownToTime;
      const finalPeriod = period ?? countdownToPeriod;
      const [hours, minutes] = finalTime.split(":").map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return { success: 0, failed: 0, errors: [] };

      const now = new Date();
      const target = new Date();
      target.setHours(finalPeriod === "PM" && hours !== 12 ? hours + 12 : hours);
      target.setMinutes(minutes);
      target.setSeconds(0);
      if (target < now) target.setDate(target.getDate() + 1);

      const timeLeft = Math.floor((target.getTime() - now.getTime()) / 1000);
      const endTimeStr = `${finalTime} ${finalPeriod}`;

      setTimerState({
        isRunning: true,
        timeLeft,
        sessionName: "Countdown",
        endTime: endTimeStr,
        isOverrun: false,
      });
      setCurrentSessionIndex(null);

      return await startTimerOnAllEnabled("Countdown", undefined, endTimeStr);
    },
    [countdownToPeriod, countdownToTime]
  );

  const stopTimer = useCallback(async () => {
    setTimerState((prev) => ({ ...prev, isRunning: false }));
    return await stopTimerOnAllEnabled();
  }, []);

  const getNextSession = useCallback(() => {
    if (currentSessionIndex === null || currentSessionIndex >= schedule.length - 1) return null;
    return schedule[currentSessionIndex + 1];
  }, [currentSessionIndex, schedule]);

  const goNextSession = useCallback(async () => {
    const nextIndex = currentSessionIndex === null ? 0 : currentSessionIndex + 1;
    if (nextIndex >= schedule.length) return false;
    await startSession(nextIndex);
    return true;
  }, [currentSessionIndex, schedule.length, startSession]);

  const value = useMemo<StageAssistContextValue>(
    () => ({
      schedule,
      setSchedule,
      settings,
      setSettings,
      timerState,
      setTimerState,
      currentSessionIndex,
      setCurrentSessionIndex,
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
      goNextSession,
    }),
    [
      schedule,
      settings,
      timerState,
      currentSessionIndex,
      countdownHours,
      countdownMinutes,
      countdownSeconds,
      countdownToTime,
      countdownToPeriod,
      startSession,
      startCountdown,
      startCountdownToTime,
      stopTimer,
      getNextSession,
      goNextSession,
    ]
  );

  return <StageAssistContext.Provider value={value}>{children}</StageAssistContext.Provider>;
};

export function useStageAssist() {
  const ctx = useContext(StageAssistContext);
  if (!ctx) throw new Error("useStageAssist must be used within StageAssistProvider");
  return ctx;
}

