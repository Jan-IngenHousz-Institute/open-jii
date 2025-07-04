import React, { ReactNode } from "react";
import Toast, { ToastType } from "react-native-toast-message";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  );
}

export function useToast() {
  function showToast(message: string, type: ToastType) {
    Toast.show({
      type,
      text1: message,
    });
  }

  return { showToast };
}
