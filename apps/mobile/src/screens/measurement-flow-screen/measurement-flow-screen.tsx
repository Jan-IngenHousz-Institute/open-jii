import { clsx } from "clsx";
import React from "react";
import { ScrollView, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { BackButton } from "./components/back-button";
import { CustomMeasurementFlowStep } from "./components/custom-measurement-flow-step";
import { ExperimentSelectionStep } from "./components/experiment-selection-step";

export function MeasurementFlowScreen() {
  const { classes } = useTheme();
  const {
    currentStep,
    flowNodes,
    currentFlowStep,
    isFlowCompleted,
    setExperimentId,
    nextStep,
    previousStep,
  } = useMeasurementFlowStore();

  const handleExperimentContinue = (experimentId: string) => {
    setExperimentId(experimentId);
    nextStep();
    console.log("Continue with experiment:", experimentId);
    console.log("Current step:", currentStep + 1);
  };

  const handleBackPress = () => {
    previousStep();
  };

  const shouldShowBackButton = currentStep > 0;

  return (
    <ScrollView className={clsx("flex-1", classes.background)}>
      <View className="p-5">
        {shouldShowBackButton && <BackButton onPress={handleBackPress} />}

        {currentStep === 0 ? (
          <ExperimentSelectionStep onContinue={handleExperimentContinue} />
        ) : (
          <CustomMeasurementFlowStep />
        )}
      </View>
    </ScrollView>
  );
}
