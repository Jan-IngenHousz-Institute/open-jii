import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { colors } from "~/constants/colors";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ visible, message, type = "info", duration = 8000, onDismiss }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [fadeAnim, onDismiss, translateY]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, fadeAnim, handleDismiss, translateY, visible]);

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return colors.semantic.success;
      case "error":
        return colors.semantic.error;
      case "warning":
        return colors.semantic.warning;
      case "info":
      default:
        return colors.semantic.info;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: visible ? fadeAnim : 0,
          transform: [{ translateY }],
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
        <X size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    width: width - 32,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  message: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});
