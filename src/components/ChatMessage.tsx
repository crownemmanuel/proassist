/**
 * ChatMessage Component
 *
 * Displays a single chat message in the global chat assistant.
 * Supports user messages, assistant responses, and action execution status.
 */

import React from "react";
import { ChatMessage as ChatMessageType, ExecutedAction } from "../types/globalChat";
import { FaCheck, FaTimes } from "react-icons/fa";

interface ChatMessageProps {
  message: ChatMessageType;
}

const messageStyles: Record<string, React.CSSProperties> = {
  containerUser: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "12px",
  },
  containerAssistant: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: "12px",
  },
  bubbleUser: {
    maxWidth: "85%",
    borderRadius: "16px",
    borderBottomRightRadius: "4px",
    padding: "12px 16px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
  },
  bubbleAssistant: {
    maxWidth: "85%",
    borderRadius: "16px",
    borderBottomLeftRadius: "4px",
    padding: "12px 16px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 255, 255, 0.9)",
  },
  bubbleSystem: {
    maxWidth: "85%",
    borderRadius: "16px",
    padding: "12px 16px",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#fcd34d",
    border: "1px solid rgba(245, 158, 11, 0.3)",
  },
  content: {
    fontSize: "14px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
  },
  imagePreview: {
    marginTop: "8px",
  },
  image: {
    maxHeight: "128px",
    borderRadius: "8px",
    objectFit: "contain",
  },
  loadingDots: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "8px",
  },
  dot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#60a5fa",
    borderRadius: "50%",
    animation: "bounce 1s infinite",
  },
  actionsContainer: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
  },
  actionsLabel: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: "8px",
  },
  actionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  timestampUser: {
    fontSize: "11px",
    marginTop: "8px",
    color: "rgba(191, 219, 254, 0.7)",
  },
  timestampAssistant: {
    fontSize: "11px",
    marginTop: "8px",
    color: "rgba(255, 255, 255, 0.4)",
  },
};

const actionBadgeStyles: Record<string, React.CSSProperties> = {
  success: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    color: "#86efac",
  },
  error: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
  },
  indicator: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },
  indicatorSuccess: {
    backgroundColor: "#4ade80",
  },
  indicatorError: {
    backgroundColor: "#f87171",
  },
  typeLabel: {
    fontWeight: 600,
  },
  message: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const containerStyle = isUser
    ? messageStyles.containerUser
    : messageStyles.containerAssistant;

  const bubbleStyle = isUser
    ? messageStyles.bubbleUser
    : isSystem
      ? messageStyles.bubbleSystem
      : messageStyles.bubbleAssistant;

  const timestampStyle = isUser
    ? messageStyles.timestampUser
    : messageStyles.timestampAssistant;

  return (
    <div style={containerStyle}>
      <div style={bubbleStyle}>
        {/* Message content */}
        <div style={messageStyles.content}>{message.content}</div>

        {/* Attached image preview */}
        {message.image && (
          <div style={messageStyles.imagePreview}>
            <img
              src={message.image}
              alt="Attached"
              style={messageStyles.image as React.CSSProperties}
            />
          </div>
        )}

        {/* Loading indicator */}
        {message.isLoading && (
          <div style={messageStyles.loadingDots}>
            <div
              style={{
                ...messageStyles.dot,
                animationDelay: "0ms",
              }}
            />
            <div
              style={{
                ...messageStyles.dot,
                animationDelay: "150ms",
              }}
            />
            <div
              style={{
                ...messageStyles.dot,
                animationDelay: "300ms",
              }}
            />
          </div>
        )}

        {/* Executed actions */}
        {message.actions && message.actions.length > 0 && (
          <div style={messageStyles.actionsContainer}>
            <div style={messageStyles.actionsLabel}>Actions executed:</div>
            <div style={messageStyles.actionsList as React.CSSProperties}>
              {message.actions.map((action, index) => (
                <ActionBadge key={index} action={action} />
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div style={timestampStyle}>{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

/**
 * Action badge component showing execution status
 */
const ActionBadge: React.FC<{ action: ExecutedAction }> = ({ action }) => {
  const isSuccess = action.success;
  const typeLabel = action.type === "internal" ? "App" : "ProPresenter";

  const badgeStyle = isSuccess
    ? actionBadgeStyles.success
    : actionBadgeStyles.error;

  const indicatorStyle = {
    ...actionBadgeStyles.indicator,
    ...(isSuccess
      ? actionBadgeStyles.indicatorSuccess
      : actionBadgeStyles.indicatorError),
  };

  return (
    <div style={badgeStyle}>
      <span style={indicatorStyle} />
      <span style={actionBadgeStyles.typeLabel}>{typeLabel}:</span>
      <span style={actionBadgeStyles.message as React.CSSProperties}>
        {action.message || action.action}
      </span>
      {isSuccess ? (
        <FaCheck size={10} style={{ color: "#4ade80" }} />
      ) : (
        <FaTimes size={10} style={{ color: "#f87171" }} />
      )}
    </div>
  );
};

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default ChatMessage;
