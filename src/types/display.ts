export type DisplayLayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DisplayLayout = {
  text: DisplayLayoutRect;
  reference: DisplayLayoutRect;
};

export type TextShadow = {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
};

export type TextStroke = {
  width: number;
  color: string;
};

export type FontStyle = {
  color: string;
  bold: boolean;
  italic: boolean;
  stroke?: TextStroke;
  shadow?: TextShadow;
};

export type DisplaySettings = {
  enabled: boolean;
  windowAudienceScreen: boolean;
  webEnabled: boolean;
  monitorIndex: number | null;
  backgroundColor: string;
  backgroundImagePath?: string;
  textFont: string;
  referenceFont: string;
  textStyle: FontStyle;
  referenceStyle: FontStyle;
  layout: DisplayLayout;
};

export type DisplayScripture = {
  verseText: string;
  reference: string;
};

export const DISPLAY_SETTINGS_KEY = "proassist-display-settings";

export const DEFAULT_DISPLAY_LAYOUT: DisplayLayout = {
  text: {
    x: 0.08,
    y: 0.1,
    width: 0.84,
    height: 0.6,
  },
  reference: {
    x: 0.08,
    y: 0.75,
    width: 0.84,
    height: 0.16,
  },
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  enabled: false,
  windowAudienceScreen: false,
  webEnabled: false,
  monitorIndex: null,
  backgroundColor: "#000000",
  backgroundImagePath: "",
  textFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  referenceFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  textStyle: {
    color: "#ffffff",
    bold: false,
    italic: false,
  },
  referenceStyle: {
    color: "#ffffff",
    bold: false,
    italic: false,
  },
  layout: DEFAULT_DISPLAY_LAYOUT,
};
