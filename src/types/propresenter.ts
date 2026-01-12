// ProPresenter connection and timer types

export interface ProPresenterConnection {
  id: string;
  name: string;
  apiUrl: string;
  timerIndex: number;
  isEnabled: boolean;
}

export interface ProPresenterTimerPayload {
  id: {
    name: string;
    index: number;
    uuid: string;
  };
  allows_overrun: boolean;
  countdown?: {
    duration: number;
  };
  count_down_to_time?: {
    time_of_day: number;
    period: string;
  };
}

export interface ProPresenterTimerResponse {
  id: {
    name: string;
    index: number;
    uuid: string;
  };
  allows_overrun: boolean;
  countdown?: {
    duration: number;
  };
}

export interface ProPresenterSlidePayload {
  presentation_uuid?: string;
  slide_index?: number;
}

export interface ProPresenterVersionResponse {
  name: string;
  platform: string;
  os_version: string;
  version: string;
  host_description: string;
  api_version?: string; // Optional, may be present in some API versions
}

// Stage Assist Schedule Types
export interface ScheduleItem {
  id: number;
  session: string;
  startTime: string;
  endTime: string;
  duration: string;
  minister?: string;
}

export interface TimerState {
  isRunning: boolean;
  timeLeft: number;
  sessionName?: string;
  endTime?: string;
  isOverrun?: boolean;
}

export type Period = "AM" | "PM";

export type TimeAdjustmentMode = "NONE" | "EARLY_END" | "OVERRUN" | "BOTH";

// AI Schedule parsing response
export interface AIScheduleResponse {
  action: "none" | "SetCountDown" | "CountDownToTime" | "UpdateSchedule";
  actionValue?: number | string | ScheduleItem[];
  responseText: string;
}
