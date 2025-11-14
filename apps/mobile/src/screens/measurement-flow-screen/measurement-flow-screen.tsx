import { clsx } from "clsx";
import { useKeepAwake } from "expo-keep-awake";
import React from "react";
import { View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { BackButton } from "./components/back-button";
import { EndFlowButton } from "./components/end-flow-button";
import { ExperimentSelectionStep } from "./components/experiment-selection-step";
import { MeasurementFlowContainer } from "./components/measurement-flow-container";

export function MeasurementFlowScreen() {
  useKeepAwake();
  const { classes } = useTheme();
  const { currentStep, previousStep, resetFlow, flowNodes, currentFlowStep, isFlowFinished } =
    useMeasurementFlowStore();
  const { clearHistory } = useFlowAnswersStore();

  const handleBackPress = () => {
    previousStep();
  };

  const handleEndFlow = () => {
    resetFlow();
    clearHistory();
  };

  const shouldShowNavigationButtons = currentStep > 0;
  const isFlowCompleted = currentFlowStep >= flowNodes.length;
  const isInCompletedState = isFlowCompleted && isFlowFinished;
  // Hide back button on first flow step (currentFlowStep === 0) and in completed state
  const shouldShowBackButton =
    shouldShowNavigationButtons && currentFlowStep > 0 && !isInCompletedState;

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View className="flex-1 p-5">
        {shouldShowNavigationButtons && (
          <View className="mb-4 flex-row justify-between">
            {shouldShowBackButton && <BackButton onPress={handleBackPress} />}
            {!shouldShowBackButton && <View />}
            <EndFlowButton onPress={handleEndFlow} />
          </View>
        )}

        {currentStep === 0 ? <ExperimentSelectionStep /> : <MeasurementFlowContainer />}
      </View>
    </View>
  );
}
