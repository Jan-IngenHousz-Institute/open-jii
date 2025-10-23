import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface FlowProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  iterationCount: number;
}

export function FlowProgressIndicator({ currentStep, totalSteps, iterationCount }: FlowProgressIndicatorProps) {
  const { classes } = useTheme();

  return (
    <View className="mb-6">
      <Text className={clsx("mb-4 text-center text-2xl font-bold", classes.text)}>
        Cycle {iterationCount + 1}
      </Text>
      <View className="flex-row items-center justify-between">
        <View className={clsx("h-2 flex-1 rounded-full", classes.surface)}>
          <View 
            className={clsx("h-full rounded-full", classes.button)}
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </View>
        <Text className={clsx("ml-3 text-sm", classes.textMuted)}>
          {currentStep + 1}/{totalSteps}
        </Text>
      </View>
    </View>
  );
}
