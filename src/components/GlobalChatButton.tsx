/**
 * GlobalChatButton Component
 *
 * A floating action button that opens the global AI chat assistant.
 * Positioned in the bottom-right corner of the screen.
 */

import React, { useState } from "react";
import { FaMagic, FaTimes } from "react-icons/fa";

interface GlobalChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasUnread?: boolean;
}

const buttonStyles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 999,
  },
  button: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    transition: "all 0.3s ease",
  },
  buttonOpen: {
    background: "linear-gradient(135deg, #475569, #334155)",
  },
  buttonClosed: {
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  },
  buttonHover: {
    transform: "scale(1.05)",
    boxShadow: "0 6px 24px rgba(59, 130, 246, 0.4)",
  },
  icon: {
    color: "#fff",
    fontSize: "22px",
    transition: "transform 0.3s ease",
  },
  unreadBadge: {
    position: "absolute",
    top: "-4px",
    right: "-4px",
    width: "16px",
    height: "16px",
    backgroundColor: "#ef4444",
    borderRadius: "50%",
    border: "2px solid #0f172a",
    animation: "pulse 2s infinite",
  },
  tooltip: {
    position: "absolute",
    right: "64px",
    top: "50%",
    transform: "translateY(-50%)",
    padding: "6px 12px",
    backgroundColor: "#1e293b",
    color: "#fff",
    fontSize: "14px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    transition: "all 0.2s ease",
  },
  tooltipHidden: {
    opacity: 0,
    transform: "translateY(-50%) translateX(8px)",
    pointerEvents: "none",
  },
  tooltipVisible: {
    opacity: 1,
    transform: "translateY(-50%) translateX(0)",
  },
  tooltipArrow: {
    position: "absolute",
    right: "-4px",
    top: "50%",
    transform: "translateY(-50%) rotate(45deg)",
    width: "8px",
    height: "8px",
    backgroundColor: "#1e293b",
  },
  pulseRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
  },
};

export const GlobalChatButton: React.FC<GlobalChatButtonProps> = ({
  onClick,
  isOpen,
  hasUnread = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const buttonStyle: React.CSSProperties = {
    ...buttonStyles.button,
    ...(isOpen ? buttonStyles.buttonOpen : buttonStyles.buttonClosed),
    ...(isHovered && !isOpen ? buttonStyles.buttonHover : {}),
  };

  const tooltipStyle: React.CSSProperties = {
    ...buttonStyles.tooltip,
    ...(isHovered && !isOpen
      ? buttonStyles.tooltipVisible
      : buttonStyles.tooltipHidden),
  };

  return (
    <div style={buttonStyles.container}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={buttonStyle}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        {/* Pulse ring when closed */}
        {!isOpen && <span style={buttonStyles.pulseRing as React.CSSProperties} />}

        {/* Icon */}
        {isOpen ? (
          <FaTimes style={buttonStyles.icon} />
        ) : (
          <FaMagic style={buttonStyles.icon} />
        )}

        {/* Unread indicator */}
        {hasUnread && !isOpen && (
          <span style={buttonStyles.unreadBadge as React.CSSProperties} />
        )}
      </button>

      {/* Tooltip */}
      <div style={tooltipStyle as React.CSSProperties}>
        AI Assistant
        <div style={buttonStyles.tooltipArrow as React.CSSProperties} />
      </div>
    </div>
  );
};

export default GlobalChatButton;
