import { useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
}

export default function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration = 3000,
  ) => {
    setToast({
      visible: true,
      message,
      type,
    });

    // Auto-hide toast after duration
    setTimeout(() => {
      hideToast();
    }, duration);
  };

  const hideToast = () => {
    setToast((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
