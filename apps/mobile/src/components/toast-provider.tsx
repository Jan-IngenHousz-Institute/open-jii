import { cva } from "class-variance-authority";
import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { Animated, Text } from "react-native";

const toastContainer = cva(
  "absolute top-0 left-0 right-0 z-50 mx-4 mt-6 rounded-xl px-4 py-3 shadow-lg",
  {
    variants: {
      type: {
        success: "bg-green-500",
        error: "bg-red-500",
      },
    },
  },
);

type ToastType = "success" | "error";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [message, setMessage] = useState<string>("");
  const [type, setType] = useState<ToastType>("success");
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const showToast = useCallback(
    (msg: string, toastType: ToastType = "success") => {
      setMessage(msg);
      setType(toastType);
      setVisible(true);

      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2500),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    },
    [slideAnim],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View
          style={{ transform: [{ translateY: slideAnim }] }}
          className={toastContainer({ type })}
        >
          <Text className="text-center text-base font-semibold text-white">{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
