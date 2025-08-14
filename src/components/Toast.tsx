import React, { useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  durationMs?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  visible,
  durationMs = 2000,
  onClose,
}) => {
  useEffect(() => {
    if (!visible) return;
    const timeoutId = setTimeout(() => {
      onClose && onClose();
    }, durationMs);
    return () => clearTimeout(timeoutId);
  }, [visible, durationMs, onClose]);

  if (!visible) return null;

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {message}
    </div>
  );
};

export default Toast;
