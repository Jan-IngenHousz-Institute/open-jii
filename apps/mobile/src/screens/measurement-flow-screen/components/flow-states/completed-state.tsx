import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function CompletedState() {
  const { classes } = useTheme();
  const { iterationCount, startNewIteration, resetFlow } = useMeasurementFlowStore();
  const { clearHistory } = useFlowAnswersStore();

  const handleFinishFlow = () => {
    resetFlow();
    clearHistory();
  };

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Cycle Complete</Text>
      </View>

      <View className="flex-1 items-center justify-center p-4">
        <Text className={clsx("mb-2 text-center", classes.textSecondary)}>
          You have finished the measurement flow cycle.
        </Text>
        <Text className={clsx("text-center text-sm", classes.textMuted)}>
          Measurement {iterationCount + 1}
        </Text>
      </View>

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <View className="flex-row gap-3">
          <Button
            title="Finish Data Collection"
            onPress={handleFinishFlow}
            variant="outline"
            style={{ flex: 1 }}
            textStyle={{ color: "#ef4444" }}
          />
          <Button title="Start New Cycle" onPress={startNewIteration} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}
