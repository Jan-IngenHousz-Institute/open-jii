import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking } from "react-native";

export interface UseProfileScreenLogic {
  // State
  toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  };

  // User data
  user: {
    email: string;
    name: string;
    organization: string;
    lastLogin: string;
  };

  // Actions
  handleOpenWebProfile: () => Promise<void>;
  handleLogout: () => void;
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }) => void;
}

export function useProfileScreenLogic(): UseProfileScreenLogic {
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Mock user data - in real app, this would come from context/store
  const user = {
    email: "researcher@example.com",
    name: "Alex Researcher",
    organization: "Plant Science Institute",
    lastLogin: "2025-06-10 09:30:15",
  };

  const handleOpenWebProfile = async () => {
    try {
      const url = "https://multispeq.org/profile";
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        setToast({
          visible: true,
          message: "Cannot open web profile",
          type: "error",
        });
      }
    } catch (error) {
      setToast({
        visible: true,
        message: "Failed to open web profile",
        type: "error",
      });
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear stored authentication data
              await AsyncStorage.multiRemove([
                "authToken",
                "userEmail",
                "userData",
              ]);

              setToast({
                visible: true,
                message: "Logged out successfully",
                type: "success",
              });

              // Navigate to login screen after a short delay
              setTimeout(() => {
                router.replace("/(auth)/login");
              }, 1000);
            } catch (error) {
              setToast({
                visible: true,
                message: "Error logging out",
                type: "error",
              });
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return {
    // State
    toast,

    // User data
    user,

    // Actions
    handleOpenWebProfile,
    handleLogout,
    setToast,
  };
}
