import React from "react";
import { Keyboard, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

import { BackButton } from "./back-button";
import { advanceWithAnswer } from "./flow-nodes/utils/advance-with-answer";
import { NextButton } from "./next-button";

export function NavigationButtons() {
  const { t } = useTranslation("measurementFlow");
  const {
    flowNodes,
    currentFlowStep,
    experimentId,
    previousStep,
    isFromOverview,
    isQuestionsSubmitPending,
    returnToOverview,
    iterationCount,
  } = useMeasurementFlowStore();

  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  const navStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value),
  }));
  // Get current node to check type
  const currentNode = flowNodes[currentFlowStep];
  const currentAnswer = useFlowAnswersStore((s) =>
    currentNode?.type === "question" ? s.getAnswer(iterationCount, currentNode.id) : undefined,
  );
  const isInstructionOrQuestion =
    currentNode?.type === "instruction" || currentNode?.type === "question";

  // Show navigation buttons only for instruction/question nodes, not on the submit/review screen
  const shouldShowNavigationButtons =
    !!experimentId && isInstructionOrQuestion && !isQuestionsSubmitPending;

  if (!shouldShowNavigationButtons) {
    return null;
  }

  // yes_no and multi_choice auto-advance on tap, no Next button needed, unless the question is optional
  // then we show the Next button so that users can choose to skip it
  const isAutoAdvanceQuestion =
    currentNode?.type === "question" &&
    (currentNode.content.kind === "yes_no" || currentNode.content.kind === "multi_choice");

  const handleBackPress = () => {
    Keyboard.dismiss();
    previousStep();
  };

  const handleReturnToOverview = () => {
    Keyboard.dismiss();
    returnToOverview();
  };

  const handleNextPress = () => {
    Keyboard.dismiss();
    // For questions, use shared utility to handle answer logic and advance
    if (currentNode?.type === "question") {
      advanceWithAnswer(currentNode, currentAnswer ?? "");
    } else {
      // For non-question nodes, just advance
      useMeasurementFlowStore.getState().nextStep();
    }
  };

  // For questions, check if answer is valid
  const isNextDisabled =
    currentNode?.type === "question" && currentNode.content.required && !currentAnswer;

  return (
    <Animated.View className="bg-card w-full" style={navStyle}>
      {isFromOverview ? (
        <View className="px-4 py-3">
          <Button
            title={t("measurementFlow:navigation.backToOverview")}
            onPress={handleReturnToOverview}
            isDisabled={isNextDisabled}
            style={{ height: 44 }}
          />
        </View>
      ) : (
        <View className="flex-row items-center justify-between px-4 py-3">
          <BackButton onPress={handleBackPress} />
          {(!isAutoAdvanceQuestion || (isAutoAdvanceQuestion && !currentNode.content.required)) && (
            <NextButton onPress={handleNextPress} isDisabled={isNextDisabled} />
          )}
        </View>
      )}
    </Animated.View>
  );
}
