import React, { useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  durationMs?: number;
  autoHide?: boolean; // if false, persist until closed
  showClose?: boolean; // show an X button
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  visible,
  durationMs = 2000,
  autoHide = true,
  showClose = true,
  onClose,
}) => {
  useEffect(() => {
    if (!visible || !autoHide) return;
    const timeoutId = setTimeout(() => {
      onClose && onClose();
    }, durationMs);
    return () => clearTimeout(timeoutId);
  }, [visible, durationMs, autoHide, onClose]);

  if (!visible) return null;

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span className="toast-text">{message}</span>
      {showClose && (
        <button
          className="toast-close icon-button"
          aria-label="Close notification"
          onClick={() => onClose && onClose()}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default Toast;
