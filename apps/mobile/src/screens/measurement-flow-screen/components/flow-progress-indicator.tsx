import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function FlowProgressIndicator() {
  const { classes } = useTheme();
  const { currentFlowStep, flowNodes, iterationCount } = useMeasurementFlowStore();
  const totalSteps = flowNodes.length || 1;

  return (
    <View className="mb-6">
      <Text className={clsx("mb-4 text-center text-2xl font-bold", classes.text)}>
        Cycle {iterationCount + 1}
      </Text>
      <View className="flex-row items-center justify-between">
        <View className={clsx("h-2 flex-1 rounded-full", classes.surface)}>
          <View
            className={clsx("h-full rounded-full", classes.button)}
            style={{ width: `${((currentFlowStep + 1) / totalSteps) * 100}%` }}
          />
        </View>
        <Text className={clsx("ml-3 text-sm", classes.textMuted)}>
          {currentFlowStep + 1}/{totalSteps}
        </Text>
      </View>
    </View>
  );
}
