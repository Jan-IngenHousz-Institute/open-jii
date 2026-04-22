import clsx from "clsx";
import React, { useEffect } from "react";
import { Keyboard, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { BackButton } from "./back-button";
import { advanceWithAnswer } from "./flow-nodes/utils/advance-with-answer";
import { NextButton } from "./next-button";

export function NavigationButtons() {
  const {
    flowNodes,
    currentFlowStep,
    experimentId,
    previousStep,
    isFromOverview,
    returnToOverview,
  } = useMeasurementFlowStore();

  const { classes } = useTheme();
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  const isKeyboardVisibleSV = useSharedValue(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      isKeyboardVisibleSV.value = true;
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      isKeyboardVisibleSV.value = false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isKeyboardVisibleSV]);

  const navStyle = useAnimatedStyle(() => {
    let height = keyboard.height.value;

    // fallback only if keyboard is hidden but value is stuck
    if (!isKeyboardVisibleSV.value && height > 0) {
      height = 0;
    }

    return {
      paddingBottom: Math.max(0, height - insets.bottom),
    };
  });
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
    <Animated.View className={clsx("w-full", classes.card)} style={navStyle}>
      {isFromOverview ? (
        <View className="px-4 py-3">
          <Button
            title="Back to overview"
            onPress={returnToOverview}
            isDisabled={isNextDisabled}
            style={{ height: 44 }}
          />
        </View>
      ) : (
        <View className="flex-row items-center justify-between py-3">
          <BackButton onPress={handleBackPress} />
          {(!isAutoAdvanceQuestion || (isAutoAdvanceQuestion && !currentNode.content.required)) && (
            <NextButton onPress={handleNextPress} isDisabled={isNextDisabled} />
          )}
        </View>
      )}
    </Animated.View>
  );
}
