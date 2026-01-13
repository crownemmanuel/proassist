/**
 * App Action Service
 * 
 * Handles internal app actions triggered by the global AI assistant.
 * Actions include creating slides, managing playlists, and timer control.
 */

import { v4 as uuidv4 } from "uuid";
import {
  CreateSlidesParams,
  CreatePlaylistParams,
  SetTimerParams,
  ExecutedAction,
} from "../types/globalChat";
import { Template, Playlist, PlaylistItem, Slide, LayoutType } from "../types";
import { ScheduleItem } from "../types/propresenter";
import { generateSlidesFromText } from "./aiService";
import { getAppSettings } from "../utils/aiConfig";
import {
  startTimerOnAllEnabled,
  stopTimerOnAllEnabled,
} from "./propresenterService";

// ============================================
// Slide Creation Actions
// ============================================

/**
 * Create slides from text using a template
 * Returns the created slides to be added to UI
 */
export async function createSlides(
  params: CreateSlidesParams,
  templates: Template[],
  onSlidesCreated?: (slides: Slide[], templateId: string) => void
): Promise<ExecutedAction> {
  try {
    // Find the template
    let template: Template | undefined;

    if (params.templateId) {
      template = templates.find((t) => t.id === params.templateId);
    } else if (params.templateName) {
      // Match by name (case-insensitive)
      const lowerName = params.templateName.toLowerCase();
      template = templates.find(
        (t) =>
          t.name.toLowerCase() === lowerName ||
          t.name.toLowerCase().includes(lowerName)
      );
    }

    if (!template) {
      // Auto-select first available template
      template = templates[0];
    }

    if (!template) {
      return {
        type: "internal",
        action: "createSlides",
        success: false,
        message: "No templates available",
      };
    }

    const appSettings = getAppSettings();
    let slides: Pick<Slide, "text" | "layout">[];

    // Process based on template type
    if (template.processingType === "ai" || template.processWithAI) {
      // Use AI to generate slides
      slides = await generateSlidesFromText(params.text, template, appSettings);
    } else if (template.processingType === "simple") {
      // Simple line-by-line processing
      slides = processSimpleText(params.text, template);
    } else if (template.processingType === "regex" && template.logic) {
      // Regex-based processing
      slides = processRegexText(params.text, template);
    } else if (template.processingType === "javascript" && template.logic) {
      // JavaScript-based processing
      slides = processJavaScriptText(params.text, template);
    } else {
      // Default: simple processing
      slides = processSimpleText(params.text, template);
    }

    if (slides.length === 0) {
      return {
        type: "internal",
        action: "createSlides",
        success: false,
        message: "No slides could be generated from the input",
      };
    }

    // Convert to full Slide objects
    const fullSlides: Slide[] = slides.map((s, index) => ({
      id: uuidv4(),
      text: s.text,
      layout: s.layout,
      order: index,
    }));

    // Notify the UI to add slides
    if (onSlidesCreated) {
      onSlidesCreated(fullSlides, template.id);
    }

    return {
      type: "internal",
      action: "createSlides",
      success: true,
      message: `Created ${fullSlides.length} slide(s) using "${template.name}" template`,
    };
  } catch (error) {
    console.error("Error creating slides:", error);
    return {
      type: "internal",
      action: "createSlides",
      success: false,
      message: error instanceof Error ? error.message : "Failed to create slides",
    };
  }
}

/**
 * Simple text processing - split by double newlines or use whole text
 */
function processSimpleText(
  text: string,
  template: Template
): Pick<Slide, "text" | "layout">[] {
  const slides: Pick<Slide, "text" | "layout">[] = [];
  const defaultLayout = template.availableLayouts[0] || "one-line";

  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n").filter((l) => l.trim());
    const lineCount = lines.length;
    
    // Select appropriate layout based on line count
    const layout = selectLayoutForLineCount(lineCount, template.availableLayouts);
    
    slides.push({
      text: lines.join("\n"),
      layout: layout || defaultLayout,
    });
  }

  return slides;
}

/**
 * Regex-based text processing
 */
function processRegexText(
  text: string,
  template: Template
): Pick<Slide, "text" | "layout">[] {
  try {
    const regex = new RegExp(template.logic, "gm");
    const matches = text.match(regex);
    const defaultLayout = template.availableLayouts[0] || "one-line";

    if (!matches) {
      return [{ text, layout: defaultLayout }];
    }

    return matches.map((match) => ({
      text: match.trim(),
      layout: defaultLayout,
    }));
  } catch (error) {
    console.error("Regex processing error:", error);
    return [{ text, layout: template.availableLayouts[0] || "one-line" }];
  }
}

/**
 * JavaScript-based text processing
 */
function processJavaScriptText(
  text: string,
  template: Template
): Pick<Slide, "text" | "layout">[] {
  try {
    // Create a function from the logic
    const fn = new Function("input", template.logic);
    const result = fn(text);

    const defaultLayout = template.availableLayouts[0] || "one-line";

    if (Array.isArray(result)) {
      return result.map((item) => {
        if (typeof item === "string") {
          return { text: item, layout: defaultLayout };
        } else if (typeof item === "object" && item.text) {
          return { text: item.text, layout: item.layout || defaultLayout };
        }
        return { text: String(item), layout: defaultLayout };
      });
    }

    return [{ text: String(result), layout: defaultLayout }];
  } catch (error) {
    console.error("JavaScript processing error:", error);
    return [{ text, layout: template.availableLayouts[0] || "one-line" }];
  }
}

/**
 * Select the best layout based on line count
 */
function selectLayoutForLineCount(
  lineCount: number,
  availableLayouts: LayoutType[]
): LayoutType | undefined {
  const layoutMap: Record<number, LayoutType> = {
    1: "one-line",
    2: "two-line",
    3: "three-line",
    4: "four-line",
    5: "five-line",
    6: "six-line",
  };

  // Exact match
  const exactLayout = layoutMap[lineCount];
  if (exactLayout && availableLayouts.includes(exactLayout)) {
    return exactLayout;
  }

  // Find the smallest layout that can fit the lines
  const layoutOrder: LayoutType[] = [
    "one-line",
    "two-line",
    "three-line",
    "four-line",
    "five-line",
    "six-line",
  ];

  for (const layout of layoutOrder) {
    const layoutLines = layoutOrder.indexOf(layout) + 1;
    if (layoutLines >= lineCount && availableLayouts.includes(layout)) {
      return layout;
    }
  }

  // Return the largest available layout
  for (let i = layoutOrder.length - 1; i >= 0; i--) {
    if (availableLayouts.includes(layoutOrder[i])) {
      return layoutOrder[i];
    }
  }

  return undefined;
}

// ============================================
// Playlist Actions
// ============================================

/**
 * Create a new playlist
 */
export async function createPlaylist(
  params: CreatePlaylistParams,
  templates: Template[],
  onPlaylistCreated?: (playlist: Playlist) => void
): Promise<ExecutedAction> {
  try {
    const playlistId = uuidv4();
    const items: PlaylistItem[] = [];

    if (params.items && params.items.length > 0) {
      for (const item of params.items) {
        const template = templates.find((t) => t.id === item.templateId);
        if (!template) continue;

        const appSettings = getAppSettings();
        let slides: Pick<Slide, "text" | "layout">[];

        if (template.processingType === "ai" || template.processWithAI) {
          slides = await generateSlidesFromText(item.text, template, appSettings);
        } else {
          slides = processSimpleText(item.text, template);
        }

        const fullSlides: Slide[] = slides.map((s, index) => ({
          id: uuidv4(),
          text: s.text,
          layout: s.layout,
          order: index,
        }));

        items.push({
          id: uuidv4(),
          title: item.text.split("\n")[0].substring(0, 50),
          templateName: template.name,
          templateColor: template.color,
          slides: fullSlides,
        });
      }
    }

    const playlist: Playlist = {
      id: playlistId,
      name: params.name,
      items,
    };

    if (onPlaylistCreated) {
      onPlaylistCreated(playlist);
    }

    return {
      type: "internal",
      action: "createPlaylist",
      success: true,
      message: `Created playlist "${params.name}" with ${items.length} item(s)`,
    };
  } catch (error) {
    console.error("Error creating playlist:", error);
    return {
      type: "internal",
      action: "createPlaylist",
      success: false,
      message: error instanceof Error ? error.message : "Failed to create playlist",
    };
  }
}

// ============================================
// Timer Actions
// ============================================

/**
 * Set and start a timer
 */
export async function setTimer(
  params: SetTimerParams,
  onTimerSet?: (params: SetTimerParams) => void
): Promise<ExecutedAction> {
  try {
    const sessionName = params.sessionName || "AI Timer";

    if (params.type === "countdown") {
      const duration = typeof params.value === "number" ? params.value : parseInt(String(params.value), 10);
      
      if (isNaN(duration) || duration <= 0) {
        return {
          type: "internal",
          action: "setTimer",
          success: false,
          message: "Invalid countdown duration",
        };
      }

      const result = await startTimerOnAllEnabled(sessionName, duration);
      
      if (onTimerSet) {
        onTimerSet(params);
      }

      if (result.success > 0) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return {
          type: "internal",
          action: "setTimer",
          success: true,
          message: `Started ${minutes}:${seconds.toString().padStart(2, "0")} countdown timer`,
        };
      } else {
        return {
          type: "internal",
          action: "setTimer",
          success: false,
          message: "No ProPresenter connections enabled. Timer set locally.",
        };
      }
    } else if (params.type === "countdownToTime") {
      const endTime = String(params.value);
      const result = await startTimerOnAllEnabled(sessionName, undefined, endTime);
      
      if (onTimerSet) {
        onTimerSet(params);
      }

      return {
        type: "internal",
        action: "setTimer",
        success: result.success > 0,
        message: result.success > 0
          ? `Started countdown to ${endTime}`
          : "Timer set locally. No ProPresenter connections enabled.",
      };
    }

    return {
      type: "internal",
      action: "setTimer",
      success: false,
      message: "Unknown timer type",
    };
  } catch (error) {
    console.error("Error setting timer:", error);
    return {
      type: "internal",
      action: "setTimer",
      success: false,
      message: error instanceof Error ? error.message : "Failed to set timer",
    };
  }
}

/**
 * Stop all running timers
 */
export async function stopTimer(
  onTimerStopped?: () => void
): Promise<ExecutedAction> {
  try {
    await stopTimerOnAllEnabled();
    
    // Notify callback if provided
    if (onTimerStopped) {
      onTimerStopped();
    }
    
    // Dispatch event for context to update timer state
    window.dispatchEvent(new CustomEvent("ai-timer-stopped"));
    
    return {
      type: "internal",
      action: "stopTimer",
      success: true,
      message: "Timer stopped",
    };
  } catch (error) {
    console.error("Error stopping timer:", error);
    return {
      type: "internal",
      action: "stopTimer",
      success: false,
      message: error instanceof Error ? error.message : "Failed to stop timer",
    };
  }
}

/**
 * Update the schedule
 */
export async function updateSchedule(
  schedule: ScheduleItem[],
  onScheduleUpdated?: (schedule: ScheduleItem[]) => void
): Promise<ExecutedAction> {
  try {
    if (onScheduleUpdated) {
      onScheduleUpdated(schedule);
    }

    return {
      type: "internal",
      action: "updateSchedule",
      success: true,
      message: `Updated schedule with ${schedule.length} item(s)`,
    };
  } catch (error) {
    console.error("Error updating schedule:", error);
    return {
      type: "internal",
      action: "updateSchedule",
      success: false,
      message: error instanceof Error ? error.message : "Failed to update schedule",
    };
  }
}
