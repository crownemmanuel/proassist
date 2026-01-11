// Live Slides Types - matching Rust backend types

export interface LiveSlideItem {
  text: string;
  is_sub_item: boolean;
}

export interface LiveSlide {
  items: LiveSlideItem[];
  color: string;
}

export interface LiveSlideSession {
  id: string;
  name: string;
  slides: LiveSlide[];
  raw_text: string;
  created_at: number;
}

export interface LiveSlidesState {
  sessions: Record<string, LiveSlideSession>;
  server_running: boolean;
  server_port: number;
  local_ip: string;
}

// WebSocket message types
export type WsMessageType =
  | "text_update"
  | "join_session"
  | "slides_update"
  | "session_created"
  | "session_deleted"
  | "error";

export interface WsTextUpdate {
  type: "text_update";
  session_id: string;
  text: string;
}

export interface WsJoinSession {
  type: "join_session";
  session_id: string;
  client_type: "notepad" | "viewer";
}

export interface WsSlidesUpdate {
  type: "slides_update";
  session_id: string;
  slides: LiveSlide[];
  raw_text: string;
}

export interface WsSessionCreated {
  type: "session_created";
  session: LiveSlideSession;
}

export interface WsSessionDeleted {
  type: "session_deleted";
  session_id: string;
}

export interface WsError {
  type: "error";
  message: string;
}

export type WsMessage =
  | WsTextUpdate
  | WsJoinSession
  | WsSlidesUpdate
  | WsSessionCreated
  | WsSessionDeleted
  | WsError;

// Settings types
export interface LiveSlidesSettings {
  serverPort: number;
  autoStartServer: boolean;
  outputPath: string;
  outputFilePrefix: string;
}

// Default settings
export const DEFAULT_LIVE_SLIDES_SETTINGS: LiveSlidesSettings = {
  serverPort: 9876,
  autoStartServer: false,
  outputPath: "/tmp/proassist/live_slides/",
  outputFilePrefix: "live_slide_",
};
