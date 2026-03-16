import { clsx } from "clsx";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface NextButtonProps {
  onPress: () => void;
  isDisabled?: boolean;
}

export function NextButton({ onPress, isDisabled = false }: NextButtonProps) {
  const { classes, colors } = useTheme();

  // WORKAROUND: Key with timestamp to force remount on every render
  // This bypasses React Native's native style caching bug in Expo SDK 54
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      onPress={onPress}
      disabled={isDisabled}
      className={clsx(
        "h-[44px] flex-row items-center justify-end gap-1 rounded-lg px-4",
        isDisabled && "opacity-50",
      )}
    >
      <Text className={clsx("text-lg font-medium", classes.text)}>Next</Text>
      <ChevronRight size={20} color={colors.onSurface} />
    </TouchableOpacity>
  );
}
