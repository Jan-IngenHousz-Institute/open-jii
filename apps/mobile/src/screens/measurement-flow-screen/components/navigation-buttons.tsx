import clsx from "clsx";
import React from "react";
import { View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { BackButton } from "./back-button";
import { advanceWithAnswer } from "./flow-nodes/utils/advance-with-answer";
import { NextButton } from "./next-button";

export function NavigationButtons() {
  const { flowNodes, currentFlowStep, experimentId, previousStep } = useMeasurementFlowStore();
  const { classes } = useTheme();
  // Get current node to check type
  const currentNode = flowNodes[currentFlowStep];
  const isInstructionOrQuestion =
    currentNode?.type === "instruction" || currentNode?.type === "question";

  // Show navigation buttons only for instruction/question nodes
  const shouldShowNavigationButtons = !!experimentId && isInstructionOrQuestion;

  if (!shouldShowNavigationButtons) {
    return null;
  }

  // yes_no and multi_choice auto-advance on tap, no Next button needed, unless the question is optional
  // then we show the Next button so that users can choose to skip it
  const isAutoAdvanceQuestion =
    currentNode?.type === "question" &&
    (currentNode.content.kind === "yes_no" || currentNode.content.kind === "multi_choice");

  const handleBackPress = () => {
    previousStep();
  };

  const handleNextPress = () => {
    // For questions, use shared utility to handle answer logic and advance
    if (currentNode?.type === "question") {
      const { getAnswer } = useFlowAnswersStore.getState();
      const answerValue =
        getAnswer(useMeasurementFlowStore.getState().iterationCount, currentNode.id) ?? "";
      advanceWithAnswer(currentNode, answerValue);
    } else {
      // For non-question nodes, just advance
      useMeasurementFlowStore.getState().nextStep();
    }
  };

  // For questions, check if answer is valid
  const isNextDisabled =
    currentNode?.type === "question" &&
    currentNode.content.required &&
    !useFlowAnswersStore
      .getState()
      .getAnswer(useMeasurementFlowStore.getState().iterationCount, currentNode.id);

  return (
    <View className={clsx("w-full flex-row items-center justify-between py-3", classes.card)}>
      <BackButton onPress={handleBackPress} />
      {(!isAutoAdvanceQuestion || (isAutoAdvanceQuestion && !currentNode.content.required)) && (
        <NextButton onPress={handleNextPress} isDisabled={isNextDisabled} />
      )}
    </View>
  );
}
