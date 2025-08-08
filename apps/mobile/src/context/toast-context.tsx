import React, { ReactNode } from "react";
import Toast from "react-native-toast-message";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  );
}

export function useToast() {
  function showToast(message: string, type: "success" | "error" | "info") {
    Toast.show({
      type,
      text1: message,
    });
  }

  return { showToast };
}
