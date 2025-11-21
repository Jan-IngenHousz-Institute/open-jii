import { clsx } from "clsx";
import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface CheckboxProps {
  value: boolean;
  text: string;
  onChange: (value: boolean) => void;
}

export function Checkbox({ value, text, onChange }: CheckboxProps) {
  const { classes } = useTheme();

  // WORKAROUND: Key with timestamp to force remount on every render
  // This bypasses React Native's native style caching bug in Expo SDK 54
  // The timestamp ensures remount even when props stay the same (which was causing the issue)
  const renderId = Date.now();

  return (
    <TouchableOpacity
      key={renderId}
      className="flex-row items-center"
      onPress={() => onChange(!value)}
    >
      <View
        className={clsx("mr-3 h-8 w-8 items-center justify-center rounded border-2")}
        style={{
          borderColor: value ? "#10b981" : "#d1d5db",
          backgroundColor: value ? "#10b981" : "transparent",
        }}
      >
        {value && <Text className="text-base font-bold text-white">✓</Text>}
      </View>
      <Text className={clsx("text-base", classes.textSecondary)}>{text}</Text>
    </TouchableOpacity>
  );
}
