import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useExperimentFlow } from "~/hooks/use-experiment-flow";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function CustomMeasurementFlowStep() {
  const { classes } = useTheme();
  const { experimentId } = useMeasurementFlowStore();

  const { data: { body } = {} } = useExperimentFlow(experimentId);

  console.log("body", body);

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("mb-4 text-xl font-semibold", classes.text)}>
        Custom Measurement Flow
      </Text>
      <Text className={clsx("text-center", classes.textSecondary)}>
        This component will handle the measurement flow for steps after experiment selection.
      </Text>
    </View>
  );
}
