import { emit } from "@tauri-apps/api/event";
import { Monitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_DISPLAY_LAYOUT,
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTINGS_KEY,
  DisplayScripture,
  DisplaySettings,
} from "../types/display";

const DISPLAY_WINDOW_LABEL = "audience-display";

let displayWindow: WebviewWindow | null = null;

function mergeLayout(
  base: typeof DEFAULT_DISPLAY_LAYOUT,
  incoming?: Partial<typeof DEFAULT_DISPLAY_LAYOUT>
) {
  return {
    text: { ...base.text, ...(incoming?.text || {}) },
    reference: { ...base.reference, ...(incoming?.reference || {}) },
  };
}

export function loadDisplaySettings(): DisplaySettings {
  try {
    const stored = localStorage.getItem(DISPLAY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DisplaySettings>;
      const settings: DisplaySettings = {
        ...DEFAULT_DISPLAY_SETTINGS,
        ...parsed,
        layout: mergeLayout(DEFAULT_DISPLAY_LAYOUT, parsed.layout),
      };
      
      // Backward compatibility: if textStyle/referenceStyle don't exist, create them
      if (!parsed.textStyle) {
        settings.textStyle = {
          color: "#ffffff",
          bold: false,
          italic: false,
        };
      }
      if (!parsed.referenceStyle) {
        settings.referenceStyle = {
          color: "#ffffff",
          bold: false,
          italic: false,
        };
      }
      
      // Backward compatibility: if webEnabled doesn't exist, default to false
      if (parsed.webEnabled === undefined) {
        settings.webEnabled = false;
      }
      if (parsed.windowAudienceScreen === undefined) {
        settings.windowAudienceScreen = false;
      }

      // Guard against invalid values from older/local data
      if (typeof parsed.enabled !== "boolean") {
        settings.enabled = false;
      }
      if (typeof parsed.monitorIndex !== "number" || Number.isNaN(parsed.monitorIndex)) {
        settings.monitorIndex = null;
      }
      if (settings.monitorIndex === null) {
        settings.enabled = false;
      }
      
      return settings;
    }
  } catch (error) {
    console.error("[Display] Failed to load display settings:", error);
  }
  return DEFAULT_DISPLAY_SETTINGS;
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
    void emit("display:settings", settings);
  } catch (error) {
    console.error("[Display] Failed to save display settings:", error);
  }
}

// Safe monitor info structure matching Rust SafeMonitorInfo
interface SafeMonitorInfo {
  name: string | null;
  position: [number, number];
  size: [number, number];
  scale_factor: number;
}

// Convert SafeMonitorInfo to Monitor-like format for compatibility
// Note: workArea is omitted as it's not available and was causing serialization errors
function convertToMonitor(info: SafeMonitorInfo): Monitor {
  return {
    name: info.name,
    position: {
      x: info.position[0],
      y: info.position[1],
    },
    size: {
      width: info.size[0],
      height: info.size[1],
    },
    scaleFactor: info.scale_factor,
    // workArea is intentionally omitted - it was causing serialization errors
    // when it was None/undefined in the original Monitor objects
  } as Monitor;
}

export async function getAvailableMonitors(): Promise<Monitor[]> {
  try {
    // Use our safe Rust command that handles optional workArea
    const safeMonitors = await invoke<SafeMonitorInfo[]>("get_available_monitors_safe");
    return safeMonitors.map((info) => convertToMonitor(info));
  } catch (error) {
    console.error("[Display] Failed to load monitors:", error);
    // Log more details about the error for debugging
    if (error instanceof Error) {
      console.error("[Display] Error details:", error.message, error.stack);
    }
    return [];
  }
}

export async function openDisplayWindow(settings: DisplaySettings): Promise<void> {
  try {
    console.log("[Display] Opening audience display window via Rust command", settings.monitorIndex);
    
    // Call the Rust command to create or show the window
    // The parent_window parameter is automatically injected by Tauri (it's the window calling this command)
    await invoke("open_audience_display_window", { monitorIndex: settings.monitorIndex });
    
    // Try to get the window reference for future operations
    try {
      displayWindow = await WebviewWindow.getByLabel(DISPLAY_WINDOW_LABEL);
      console.log("[Display] Window opened successfully");
      
      // Emit current settings to the newly opened window
      // Add a small delay to ensure the window is ready to receive events
      setTimeout(() => {
        emit("display:settings", settings);
      }, 100);
    } catch (error) {
      console.warn("[Display] Could not get window reference, but window may still be open:", error);
      // Still try to emit settings even if we can't get the window reference
      setTimeout(() => {
        emit("display:settings", settings);
      }, 100);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Display] Failed to open display window:", error);
    throw new Error(`Failed to open display window: ${errorMsg}`);
  }
}

export async function closeDisplayWindow(): Promise<void> {
  try {
    // Try to get the window if we don't have a reference
    if (!displayWindow) {
      try {
        displayWindow = await WebviewWindow.getByLabel(DISPLAY_WINDOW_LABEL);
      } catch (error) {
        // Window doesn't exist, nothing to close
        console.log("[Display] Window doesn't exist, nothing to close");
        return;
      }
    }
    
    if (displayWindow) {
      await displayWindow.close();
      console.log("[Display] Window closed successfully");
    }
  } catch (error) {
    console.warn("[Display] Failed to close window:", error);
  } finally {
    displayWindow = null;
  }
}

// Helper to load a local file as base64 data URL
async function loadImageAsDataUrl(imagePath: string): Promise<string> {
  if (!imagePath) return "";
  
  // If already a data URL or HTTP URL, return as-is
  if (imagePath.startsWith("data:") || imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  try {
    const base64 = await invoke<string>("read_file_as_base64", {
      filePath: imagePath,
    });
    
    // Determine MIME type from file extension
    const path = imagePath.toLowerCase();
    let mimeType = "image/png"; // default
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else if (path.endsWith(".webp")) {
      mimeType = "image/webp";
    } else if (path.endsWith(".gif")) {
      mimeType = "image/gif";
    }
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("[Display] Failed to load image as base64:", error);
    return "";
  }
}

export async function sendScriptureToDisplay(
  payload: DisplayScripture
): Promise<void> {
  try {
    // Emit to local Tauri window (for native audience display window)
    await emit("display:scripture", payload);
    
    // Also broadcast to web server if enabled
    const settings = loadDisplaySettings();
    if (settings.webEnabled) {
      try {
        // For web display, convert background image to data URL
        let backgroundImageDataUrl = "";
        if (settings.backgroundImagePath) {
          backgroundImageDataUrl = await loadImageAsDataUrl(settings.backgroundImagePath);
        }
        
        // Create settings with data URL for web display
        const webSettings = {
          ...settings,
          // Replace file path with data URL for web compatibility
          backgroundImageDataUrl,
        };
        
        // Convert settings to JSON value for Rust
        const settingsJson = JSON.parse(JSON.stringify(webSettings));
        await invoke("update_display_state", {
          verseText: payload.verseText,
          reference: payload.reference,
          settings: settingsJson,
        });
      } catch (error) {
        console.error("[Display] Failed to update web display state:", error);
      }
    }
  } catch (error) {
    console.error("[Display] Failed to emit scripture:", error);
  }
}
