import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const { classes, colors } = useTheme();

  // WORKAROUND: Key with timestamp to force remount on every render
  // This bypasses React Native's native style caching bug in Expo SDK 54
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      onPress={onPress}
      className={clsx(
        "flex-row items-center justify-center rounded-lg border px-4 py-2",
        classes.border,
        "bg-transparent",
      )}
      activeOpacity={0.7}
    >
      <ArrowLeft size={16} color={colors.onSurface} />
      <Text className={clsx("ml-2 text-sm font-medium", classes.text)}>Back</Text>
    </TouchableOpacity>
  );
}
