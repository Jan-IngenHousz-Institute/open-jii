import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface ScanningStateProps {
  scanResult?: any;
}

export function ScanningState({ scanResult }: ScanningStateProps) {
  const { classes, colors } = useTheme();

  // Show completion message if scan just finished
  if (scanResult) {
    return (
      <View className="items-center py-8">
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
    <View className="items-center py-8">
      <ActivityIndicator size="large" color={colors.primary.dark} />
      <Text className={clsx("mt-4 text-center", classes.textSecondary)}>Measuring...</Text>
    </View>
  );
}
