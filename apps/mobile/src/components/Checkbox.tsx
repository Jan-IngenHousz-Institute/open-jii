import { clsx } from "clsx";
import { Check } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface CheckboxProps {
  value: boolean;
  text: string;
  onChange: (value: boolean) => void;
  textSize?: "sm" | "base";
  icon?: React.ReactNode;
}

export function Checkbox({ value, text, onChange, textSize = "base", icon }: CheckboxProps) {
  const { classes } = useTheme();

  // WORKAROUND: Key with timestamp to force remount on every render
  // This bypasses React Native's native style caching bug in Expo SDK 54
  // The timestamp ensures remount even when props stay the same (which was causing the issue)
  const renderId = Date.now();

  const checkbox = (
    <View
      className={clsx("h-6 w-6 items-center justify-center rounded-lg border-2")}
      style={{
        borderColor: value ? "#09B732" : "#011111",
        backgroundColor: value ? "#09B732" : "transparent",
      }}
    >
      {value && <Check size={14} color="#ffffff" strokeWidth={3} />}
    </View>
  );

  return (
    <TouchableOpacity
      key={renderId}
      className="flex-row items-center gap-2"
      onPress={() => onChange(!value)}
    >
      {checkbox}
      <View className="flex-row items-center gap-1">
        <Text className={clsx(textSize === "sm" ? "text-sm" : "text-base", classes.text)}>
          {text}
        </Text>
        {icon}
      </View>
    </TouchableOpacity>
  );
}
