import { Playlist } from "../types";

const PLAYLISTS_KEY = "proassist-playlists-v1";

export const loadPlaylists = (fallback: Playlist[]): Playlist[] => {
  try {
    const stored = localStorage.getItem(PLAYLISTS_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Playlist[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch (err) {
    console.error("Failed to load playlists from storage:", err);
    return fallback;
  }
};

export const savePlaylists = (playlists: Playlist[]): void => {
  try {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  } catch (err) {
    console.error("Failed to save playlists to storage:", err);
  }
};
