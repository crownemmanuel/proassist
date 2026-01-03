import { FirebaseConfig, LiveTestimoniesSettings } from "../types/testimonies";

const STORAGE_KEY_FIREBASE_CONFIG = "proassist-firebase-config";
const STORAGE_KEY_LIVE_TESTIMONIES_SETTINGS = "proassist-live-testimonies-settings";

export function saveFirebaseConfig(config: FirebaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save Firebase config:", err);
  }
}

export function loadFirebaseConfig(): FirebaseConfig | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (!saved) return null;
    return JSON.parse(saved) as FirebaseConfig;
  } catch (err) {
    console.error("Failed to load Firebase config:", err);
    return null;
  }
}

export function saveLiveTestimoniesSettings(
  settings: LiveTestimoniesSettings
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_LIVE_TESTIMONIES_SETTINGS,
      JSON.stringify(settings)
    );
  } catch (err) {
    console.error("Failed to save Live Testimonies settings:", err);
  }
}

export function loadLiveTestimoniesSettings(): LiveTestimoniesSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LIVE_TESTIMONIES_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved) as LiveTestimoniesSettings;
      // Ensure defaults
      return {
        firebaseConfig: parsed.firebaseConfig || null,
        liveTestimonyOutputPath:
          parsed.liveTestimonyOutputPath || "/tmp/proassist/live_testimony/",
        liveTestimonyFileName:
          parsed.liveTestimonyFileName || "live_testimony.txt",
        nameFormatting: parsed.nameFormatting || {
          type: "default",
        },
      };
    }
  } catch (err) {
    console.error("Failed to load Live Testimonies settings:", err);
  }
  // Return defaults
  return {
    firebaseConfig: null,
    liveTestimonyOutputPath: "/tmp/proassist/live_testimony/",
    liveTestimonyFileName: "live_testimony.txt",
    nameFormatting: {
      type: "default",
    },
  };
}
