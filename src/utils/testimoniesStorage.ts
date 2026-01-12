import { FirebaseConfig, LiveTestimoniesSettings } from "../types/testimonies";
import { SmartAutomationRule, ScheduleItemAutomation } from "../types/propresenter";

const STORAGE_KEY_FIREBASE_CONFIG = "proassist-firebase-config";
const STORAGE_KEY_LIVE_TESTIMONIES_SETTINGS = "proassist-live-testimonies-settings";
const STORAGE_KEY_SMART_AUTOMATIONS = "proassist-smart-automations";

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
        proPresenterActivation: parsed.proPresenterActivation,
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

// Smart Automations for Schedule Items
export function saveSmartAutomations(rules: SmartAutomationRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SMART_AUTOMATIONS, JSON.stringify(rules));
  } catch (err) {
    console.error("Failed to save smart automations:", err);
  }
}

export function loadSmartAutomations(): SmartAutomationRule[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SMART_AUTOMATIONS);
    if (saved) {
      return JSON.parse(saved) as SmartAutomationRule[];
    }
  } catch (err) {
    console.error("Failed to load smart automations:", err);
  }
  return [];
}

export function addSmartAutomation(rule: SmartAutomationRule): void {
  const rules = loadSmartAutomations();
  // Remove any existing rule with the same session name pattern
  const filtered = rules.filter(
    (r) => r.sessionNamePattern.toLowerCase() !== rule.sessionNamePattern.toLowerCase()
  );
  filtered.push(rule);
  saveSmartAutomations(filtered);
}

export function removeSmartAutomation(ruleId: string): void {
  const rules = loadSmartAutomations();
  saveSmartAutomations(rules.filter((r) => r.id !== ruleId));
}

export function findMatchingAutomation(sessionName: string): ScheduleItemAutomation | null {
  const rules = loadSmartAutomations();
  const normalizedName = sessionName.toLowerCase().trim();
  
  // First try exact matches
  for (const rule of rules) {
    if (rule.isExactMatch && rule.sessionNamePattern.toLowerCase().trim() === normalizedName) {
      return rule.automation;
    }
  }
  
  // Then try contains matches
  for (const rule of rules) {
    if (!rule.isExactMatch && normalizedName.includes(rule.sessionNamePattern.toLowerCase().trim())) {
      return rule.automation;
    }
  }
  
  return null;
}
