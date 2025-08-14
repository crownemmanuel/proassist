import React, { useState } from "react";
import { Playlist } from "../types";
import "../App.css"; // Ensure global styles are applied

interface PlaylistPaneProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  onSelectPlaylist: (playlistId: string) => void;
  onAddPlaylist: (name: string) => void;
  selectedItemId: string | null;
  onSelectPlaylistItem: (itemId: string) => void;
}

const PlaylistPane: React.FC<PlaylistPaneProps> = ({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onAddPlaylist,
  selectedItemId,
  onSelectPlaylistItem,
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleAddPlaylistClick = () => {
    if (newPlaylistName.trim() !== "") {
      onAddPlaylist(newPlaylistName.trim());
      setNewPlaylistName("");
    }
  };

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div>
      <div className="playlist-section-header">Playlists</div>
      <div
        style={{
          display: "flex",
          marginBottom: "15px",
          gap: "8px",
          padding: "0 10px",
        }}
      >
        <input
          type="text"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="New playlist name"
          style={{ flexGrow: 1 }}
        />
        <button onClick={handleAddPlaylistClick} title="Add Playlist">
          ➕
        </button>
      </div>
      <ul
        style={{
          listStyleType: "none",
          padding: 0,
          margin: "0 0 15px 0",
          border: "1px solid var(--app-border-color)",
          borderRadius: "4px",
        }}
      >
        {playlists.length === 0 && (
          <li
            className="list-item"
            style={{ color: "var(--app-text-color-secondary)" }}
          >
            No playlists yet.
          </li>
        )}
        {playlists.map((playlist) => (
          <li
            key={playlist.id}
            onClick={() => onSelectPlaylist(playlist.id)}
            className={`list-item ${
              playlist.id === selectedPlaylistId ? "playlist-selected" : ""
            }`}
          >
            {playlist.name}
            <span
              style={{
                fontSize: "0.8em",
                color:
                  playlist.id === selectedPlaylistId
                    ? "var(--app-playlist-selected-text)"
                    : "var(--app-text-color-secondary)",
              }}
            >
              ({playlist.items.length} items)
            </span>
          </li>
        ))}
      </ul>

      {selectedPlaylist && (
        <div style={{ marginTop: "20px" }}>
          <div className="playlist-section-header">{selectedPlaylist.name}</div>
          {selectedPlaylist.items.length === 0 && (
            <p
              style={{
                color: "var(--app-text-color-secondary)",
                fontSize: "0.9em",
                padding: "10px",
              }}
            >
              No items in this playlist. Import content to add items.
            </p>
          )}
          <ul
            style={{
              listStyleType: "none",
              padding: 0,
              margin: 0,
              border: "1px solid var(--app-border-color)",
              borderRadius: "4px",
            }}
          >
            {selectedPlaylist.items.map((item) => (
              <li
                key={item.id}
                onClick={() => onSelectPlaylistItem(item.id)}
                className={`list-item ${
                  item.id === selectedItemId ? "playlist-item-selected" : ""
                }`}
              >
                <span
                  style={{
                    fontWeight: item.id === selectedItemId ? "bold" : "normal",
                  }}
                >
                  {item.title}
                </span>
                <span
                  className="template-badge"
                  style={{
                    backgroundColor:
                      item.templateColor || "var(--app-button-bg-color)",
                    color:
                      item.templateColor && isColorDark(item.templateColor)
                        ? "white"
                        : "black",
                  }}
                >
                  {item.templateName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Helper function to determine if a color is dark (simplified)
// This helps in choosing white or black text for the template badge.
const isColorDark = (hexColor: string): boolean => {
  const color = hexColor.substring(1); // Remove #
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  // Standard luminance calculation
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128; // Threshold for darkness
};

export default PlaylistPane;
