import { clsx } from "clsx";
import React from "react";
import { ScrollView, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { ExperimentSelectionStep } from "./components/experiment-selection-step";

export function MeasurementFlowScreen() {
  const { classes } = useTheme();

  const handleExperimentContinue = (experimentId: string) => {
    // TODO: Navigate to next step or show protocol selection
    console.log("Continue with experiment:", experimentId);
  };

  return (
    <ScrollView className={clsx("flex-1", classes.background)}>
      <View className="p-5">
        <ExperimentSelectionStep onContinue={handleExperimentContinue} />
      </View>
    </ScrollView>
  );
}
