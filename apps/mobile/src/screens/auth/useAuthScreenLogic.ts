import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState, useEffect } from "react";

export interface UseAuthScreenLogic {
  // State
  email: string;
  password: string;
  isLoading: boolean;
  isCheckingAuth: boolean;
  toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  };

  // Actions
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  handleLogin: () => Promise<void>;
  handleSignUp: () => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }) => void;
}

export function useAuthScreenLogic(): UseAuthScreenLogic {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Check if user is already logged in
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        // User is already logged in, redirect to main app
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setToast({
        visible: true,
        message: "Please enter both email and password",
        type: "warning",
      });
      return;
    }

    if (!validateEmail(email)) {
      setToast({
        visible: true,
        message: "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock authentication - in real app, make API call
      if (email === "test@example.com" && password === "password") {
        await AsyncStorage.setItem("authToken", "mock-jwt-token");
        await AsyncStorage.setItem("userEmail", email);

        setToast({
          visible: true,
          message: "Login successful!",
          type: "success",
        });

        // Redirect to main app after short delay
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 1000);
      } else {
        setToast({
          visible: true,
          message: "Invalid email or password",
          type: "error",
        });
      }
    } catch (error) {
      setToast({
        visible: true,
        message: "Login failed. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setToast({
        visible: true,
        message: "Please enter both email and password",
        type: "warning",
      });
      return;
    }

    if (!validateEmail(email)) {
      setToast({
        visible: true,
        message: "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    if (password.length < 6) {
      setToast({
        visible: true,
        message: "Password must be at least 6 characters",
        type: "error",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock registration
      await AsyncStorage.setItem("authToken", "mock-jwt-token");
      await AsyncStorage.setItem("userEmail", email);

      setToast({
        visible: true,
        message: "Account created successfully!",
        type: "success",
      });

      // Redirect to main app after short delay
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 1000);
    } catch (error) {
      setToast({
        visible: true,
        message: "Sign up failed. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setToast({
        visible: true,
        message: "Please enter your email address",
        type: "warning",
      });
      return;
    }

    if (!validateEmail(email)) {
      setToast({
        visible: true,
        message: "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setToast({
        visible: true,
        message: "Password reset email sent!",
        type: "success",
      });
    } catch (error) {
      setToast({
        visible: true,
        message: "Failed to send reset email. Please try again.",
        type: "error",
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);

      // Open web browser for OAuth
      const result = await WebBrowser.openBrowserAsync(
        "https://accounts.google.com/oauth/authorize?client_id=your-client-id",
      );

      if (result.type === "opened") {
        setToast({
          visible: true,
          message: "Please complete authentication in browser",
          type: "info",
        });
      }
    } catch (error) {
      setToast({
        visible: true,
        message: "Google login failed. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    email,
    password,
    isLoading,
    isCheckingAuth,
    toast,

    // Actions
    setEmail,
    setPassword,
    handleLogin,
    handleSignUp,
    handleForgotPassword,
    handleGoogleLogin,
    setToast,
  };
}
