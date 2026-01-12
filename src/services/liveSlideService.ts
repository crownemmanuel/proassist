import { invoke } from "@tauri-apps/api/core";
import {
  LiveSlideSession,
  LiveSlidesState,
  LiveSlidesSettings,
  DEFAULT_LIVE_SLIDES_SETTINGS,
  WsMessage,
  WsTextUpdate,
  WsJoinSession,
  WsSlidesUpdate,
} from "../types/liveSlides";

// Storage key for settings
const LIVE_SLIDES_SETTINGS_KEY = "proassist-live-slides-settings";

// ============================================================================
// Settings Management
// ============================================================================

export function loadLiveSlidesSettings(): LiveSlidesSettings {
  try {
    const stored = localStorage.getItem(LIVE_SLIDES_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_LIVE_SLIDES_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load live slides settings:", e);
  }
  return { ...DEFAULT_LIVE_SLIDES_SETTINGS };
}

export function saveLiveSlidesSettings(settings: LiveSlidesSettings): void {
  try {
    localStorage.setItem(LIVE_SLIDES_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save live slides settings:", e);
  }
}

// ============================================================================
// Tauri Commands
// ============================================================================

export async function startLiveSlidesServer(port: number): Promise<string> {
  return await invoke<string>("start_live_slides_server", { port });
}

export async function stopLiveSlidesServer(): Promise<void> {
  return await invoke("stop_live_slides_server");
}

export async function createLiveSlideSession(
  name: string
): Promise<LiveSlideSession> {
  return await invoke<LiveSlideSession>("create_live_slide_session", { name });
}

export async function deleteLiveSlideSession(sessionId: string): Promise<void> {
  return await invoke("delete_live_slide_session", { sessionId });
}

export async function getLiveSlideSessions(): Promise<LiveSlideSession[]> {
  return await invoke<LiveSlideSession[]>("get_live_slide_sessions");
}

export async function getLiveSlidesServerInfo(): Promise<LiveSlidesState> {
  return await invoke<LiveSlidesState>("get_live_slides_server_info");
}

export async function getLocalIp(): Promise<string> {
  return await invoke<string>("get_local_ip");
}

// ============================================================================
// WebSocket Client
// ============================================================================

export type WsMessageHandler = (message: WsMessage) => void;

export class LiveSlidesWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private clientType: "notepad" | "viewer";
  private messageHandlers: Set<WsMessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    url: string,
    sessionId: string,
    clientType: "notepad" | "viewer" = "viewer"
  ) {
    this.url = url;
    this.sessionId = sessionId;
    this.clientType = clientType;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Validate URL format
        if (!this.url.startsWith('ws://') && !this.url.startsWith('wss://')) {
          const error = new Error(`Invalid WebSocket URL: ${this.url}`);
          console.error('[WebSocket]', error);
          reject(error);
          return;
        }

        console.log('[WebSocket] Attempting to connect to:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully to', this.url);
          this.reconnectAttempts = 0;

          // Join the session
          const joinMsg: WsJoinSession = {
            type: "join_session",
            session_id: this.sessionId,
            client_type: this.clientType,
          };
          this.send(joinMsg);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WsMessage;
            this.messageHandlers.forEach((handler) => handler(message));
          } catch (e) {
            console.error('[WebSocket] Failed to parse message:', e, 'Raw data:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
          console.error('[WebSocket] Error details:', {
            url: this.url,
            sessionId: this.sessionId,
            clientType: this.clientType,
            readyState: this.ws?.readyState,
            readyStateText: this.ws?.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                           this.ws?.readyState === WebSocket.OPEN ? 'OPEN' :
                           this.ws?.readyState === WebSocket.CLOSING ? 'CLOSING' :
                           this.ws?.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN',
          });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: this.url,
          });
          this.attemptReconnect();
        };
      } catch (e) {
        console.error('[WebSocket] Failed to create WebSocket:', e);
        reject(e);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Attempting to reconnect in ${delay}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.maxReconnectAttempts = 0; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendTextUpdate(text: string): void {
    const msg: WsTextUpdate = {
      type: "text_update",
      session_id: this.sessionId,
      text,
    };
    this.send(msg);
  }

  onMessage(handler: WsMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onSlidesUpdate(
    handler: (update: WsSlidesUpdate) => void
  ): () => void {
    return this.onMessage((message) => {
      if (
        message.type === "slides_update" &&
        message.session_id === this.sessionId
      ) {
        handler(message as WsSlidesUpdate);
      }
    });
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// URL Generation
// ============================================================================

export function generateNotepadUrl(
  localIp: string,
  port: number,
  sessionId: string
): string {
  // This generates the URL that can be opened in a browser
  // The format is: http://<local-ip>:<vite-port>/live-slides/notepad/<sessionId>?ws=<ws-port>
  // For the Tauri app, we'll use the current window location
  const wsPort = port;
  
  // If running in Tauri, use the dev server URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/live-slides/notepad/${sessionId}?wsHost=${localIp}&wsPort=${wsPort}`;
}

export function generateShareableNotepadUrl(
  localIp: string,
  appPort: number,
  wsPort: number,
  sessionId: string
): string {
  // For sharing to other devices on the network
  return `http://${localIp}:${appPort}/live-slides/notepad/${sessionId}?wsHost=${localIp}&wsPort=${wsPort}`;
}
