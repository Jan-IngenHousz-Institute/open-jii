import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function CompletedState() {
  const { classes } = useTheme();
  const { iterationCount, startNewIteration } = useMeasurementFlowStore();

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Flow Complete</Text>
      </View>

      <View className="flex-1 items-center justify-center p-4">
        <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
          Cycle Complete
        </Text>
        <Text className={clsx("mb-2 text-center", classes.textSecondary)}>
          You have finished the measurement flow.
        </Text>
        <Text className={clsx("text-center text-sm", classes.textMuted)}>
          Cycle {iterationCount + 1}
        </Text>
      </View>

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <Button title="Start New Cycle" onPress={startNewIteration} style={{ width: "100%" }} />
      </View>
    </View>
  );
}
