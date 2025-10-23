import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function MeasurementFlowScreen() {
  const { classes } = useTheme();

  return (
    <View className={clsx("flex-1 p-5", classes.background)}>
      <View className="flex-1 items-center justify-center px-5">
        <Text className={clsx("mb-4 text-center text-3xl font-bold", classes.text)}>
          Measurement Flow
        </Text>
        <Text className={clsx("mb-6 text-center text-lg leading-6", classes.textSecondary)}>
          This is your new measurement flow screen. We'll add functionality here in the next steps.
        </Text>
        <Text className={clsx("text-center text-base leading-6 opacity-80", classes.textMuted)}>
          This screen will provide enhanced measurement capabilities and workflow management for
          your plant science experiments.
        </Text>
      </View>
    </View>
  );
}
