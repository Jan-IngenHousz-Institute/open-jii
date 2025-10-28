import { clsx } from "clsx";
import { useKeepAwake } from "expo-keep-awake";
import React from "react";
import { View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { BackButton } from "./components/back-button";
import { ExperimentSelectionStep } from "./components/experiment-selection-step";
import { MeasurementFlowContainer } from "./components/measurement-flow-container";

export function MeasurementFlowScreen() {
  useKeepAwake();
  const { classes } = useTheme();
  const { currentStep, previousStep } = useMeasurementFlowStore();

  const handleBackPress = () => {
    previousStep();
  };

  const shouldShowBackButton = currentStep > 0;

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="flex-1 p-5">
        {shouldShowBackButton && <BackButton onPress={handleBackPress} />}

        {currentStep === 0 ? <ExperimentSelectionStep /> : <MeasurementFlowContainer />}
      </View>
    </View>
  );
}
