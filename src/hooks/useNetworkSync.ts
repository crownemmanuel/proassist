import { useState, useEffect, useCallback, useRef } from "react";
import { Playlist, PlaylistItem } from "../types";
import { ScheduleItem } from "../types/propresenter";
import {
  NetworkSyncSettings,
  NetworkSyncConnectionState,
  DEFAULT_NETWORK_SYNC_CONNECTION_STATE,
} from "../types/networkSync";
import {
  loadNetworkSyncSettings,
  saveNetworkSyncSettings,
  networkSyncManager,
  getSyncServerInfo,
  getLocalIp,
} from "../services/networkSyncService";

export interface UseNetworkSyncOptions {
  // Callbacks for receiving synced data
  onPlaylistItemSync?: (playlistId: string, item: PlaylistItem, action: "create" | "update") => void;
  onPlaylistItemDelete?: (playlistId: string, itemId: string) => void;
  onScheduleSync?: (schedule: ScheduleItem[], currentSessionIndex: number | null) => void;
  onFullStateSync?: (
    playlists: Playlist[] | undefined,
    schedule: ScheduleItem[] | undefined,
    currentSessionIndex: number | null | undefined
  ) => void;
}

export interface UseNetworkSyncReturn {
  // Settings
  settings: NetworkSyncSettings;
  updateSettings: (updates: Partial<NetworkSyncSettings>) => void;
  saveSettings: () => void;
  
  // Connection state
  connectionState: NetworkSyncConnectionState;
  localIp: string;
  
  // Actions
  startSync: () => Promise<void>;
  stopSync: () => Promise<void>;
  restartSync: () => Promise<void>;
  
  // Broadcast methods (for master/peer mode)
  broadcastPlaylistItem: (playlistId: string, item: PlaylistItem, action: "create" | "update") => Promise<void>;
  broadcastPlaylistDelete: (playlistId: string, itemId: string) => Promise<void>;
  broadcastSchedule: (schedule: ScheduleItem[], currentSessionIndex: number | null) => Promise<void>;
  broadcastFullState: (playlists: Playlist[], schedule: ScheduleItem[], currentSessionIndex: number | null) => Promise<void>;
  
  // Status
  isLoading: boolean;
  error: string | null;
}

export function useNetworkSync(options: UseNetworkSyncOptions = {}): UseNetworkSyncReturn {
  const [settings, setSettings] = useState<NetworkSyncSettings>(() => loadNetworkSyncSettings());
  const [connectionState, setConnectionState] = useState<NetworkSyncConnectionState>(
    DEFAULT_NETWORK_SYNC_CONNECTION_STATE
  );
  const [localIp, setLocalIp] = useState<string>("...");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store options in ref to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Fetch local IP on mount
  useEffect(() => {
    getLocalIp()
      .then(setLocalIp)
      .catch(() => setLocalIp("Unable to determine"));
  }, []);

  // Fetch server info periodically when running
  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const info = await getSyncServerInfo();
        setConnectionState((prev) => ({
          ...prev,
          serverRunning: info.running,
          connectedClients: info.connected_clients,
        }));
      } catch {
        // Ignore errors - server might not be running
      }
    };

    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Set up callbacks for the sync manager
  useEffect(() => {
    networkSyncManager.setCallbacks({
      onPlaylistItemSync: (playlistId, item, action) => {
        optionsRef.current.onPlaylistItemSync?.(playlistId, item, action);
      },
      onPlaylistItemDelete: (playlistId, itemId) => {
        optionsRef.current.onPlaylistItemDelete?.(playlistId, itemId);
      },
      onScheduleSync: (schedule, currentSessionIndex) => {
        optionsRef.current.onScheduleSync?.(schedule, currentSessionIndex);
      },
      onFullStateSync: (playlists, schedule, currentSessionIndex) => {
        optionsRef.current.onFullStateSync?.(playlists, schedule, currentSessionIndex);
      },
      onConnectionStateChange: setConnectionState,
      onError: setError,
    });
  }, []);

  // Auto-connect on mount if settings say so
  useEffect(() => {
    const settings = loadNetworkSyncSettings();
    if (settings.autoConnect && settings.mode !== "off") {
      startSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback((updates: Partial<NetworkSyncSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveSettings = useCallback(() => {
    saveNetworkSyncSettings(settings);
  }, [settings]);

  const startSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Save current settings first
      saveNetworkSyncSettings(settings);
      await networkSyncManager.start();
      
      // Update connection state
      const info = await getSyncServerInfo();
      setConnectionState((prev) => ({
        ...prev,
        serverRunning: info.running,
        connectedClients: info.connected_clients,
        error: null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setConnectionState((prev) => ({ ...prev, error: msg }));
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  const stopSync = useCallback(async () => {
    setIsLoading(true);
    try {
      await networkSyncManager.stop();
      setConnectionState({
        ...DEFAULT_NETWORK_SYNC_CONNECTION_STATE,
        serverRunning: false,
        clientConnected: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restartSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      saveNetworkSyncSettings(settings);
      await networkSyncManager.restart();
      
      const info = await getSyncServerInfo();
      setConnectionState((prev) => ({
        ...prev,
        serverRunning: info.running,
        connectedClients: info.connected_clients,
        error: null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  const broadcastPlaylistItem = useCallback(
    async (playlistId: string, item: PlaylistItem, action: "create" | "update") => {
      try {
        await networkSyncManager.broadcastPlaylistItemSync(playlistId, item, action);
      } catch (e) {
        console.error("[NetworkSync] Failed to broadcast playlist item:", e);
      }
    },
    []
  );

  const broadcastPlaylistDelete = useCallback(async (playlistId: string, itemId: string) => {
    try {
      await networkSyncManager.broadcastPlaylistItemDelete(playlistId, itemId);
    } catch (e) {
      console.error("[NetworkSync] Failed to broadcast playlist delete:", e);
    }
  }, []);

  const broadcastSchedule = useCallback(
    async (schedule: ScheduleItem[], currentSessionIndex: number | null) => {
      try {
        await networkSyncManager.broadcastScheduleSync(schedule, currentSessionIndex);
      } catch (e) {
        console.error("[NetworkSync] Failed to broadcast schedule:", e);
      }
    },
    []
  );

  const broadcastFullState = useCallback(
    async (playlists: Playlist[], schedule: ScheduleItem[], currentSessionIndex: number | null) => {
      try {
        await networkSyncManager.broadcastFullState(playlists, schedule, currentSessionIndex);
      } catch (e) {
        console.error("[NetworkSync] Failed to broadcast full state:", e);
      }
    },
    []
  );

  return {
    settings,
    updateSettings,
    saveSettings,
    connectionState,
    localIp,
    startSync,
    stopSync,
    restartSync,
    broadcastPlaylistItem,
    broadcastPlaylistDelete,
    broadcastSchedule,
    broadcastFullState,
    isLoading,
    error,
  };
}
