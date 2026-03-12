import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface ScanningStateProps {
  scanResult?: any;
  protocolName?: string;
}

export function ScanningState({ scanResult, protocolName }: ScanningStateProps) {
  const { classes, colors } = useTheme();

  // Show completion message if scan just finished
  if (scanResult) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className={clsx("text-center text-lg font-semibold", classes.text)}>
          ✓ Measurement Complete
        </Text>
        <Text className={clsx("mt-2 text-center", classes.textSecondary)}>
          Proceeding to next step...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Text className="text-center text-xl font-bold">Measuring</Text>
      {protocolName && (
        <Text className={clsx("text-center text-base", classes.textMuted)}>{protocolName}</Text>
      )}
      <ActivityIndicator size="large" color={colors.primary.dark} />
    </View>
  );
}
