import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface ScanningStateProps {
  protocolName?: string;
}

export function ScanningState({ protocolName }: ScanningStateProps) {
  const { classes, colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className={clsx("text-center text-xl font-bold", classes.text)}>Measuring</Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}
