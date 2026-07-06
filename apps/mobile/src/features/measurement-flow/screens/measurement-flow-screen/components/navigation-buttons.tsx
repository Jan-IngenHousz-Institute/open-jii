import React from "react";
import { Keyboard, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

import { BackButton } from "./back-button";
import { NextButton } from "./next-button";

export function NavigationButtons() {
  const { t } = useTranslation("measurementFlow");
  const experimentId = useWorkbookFlowStore((s) => s.experimentId);
  const currentNode = useWorkbookFlowStore((s) => s.currentNode);
  const isFromOverview = useWorkbookFlowStore((s) => s.overviewNodeId !== null);
  const isQuestionsSubmitPending = useWorkbookFlowStore((s) => s.isQuestionsSubmitPending);
  const iterationCount = useWorkbookFlowStore((s) => s.iterationCount);

  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  const navStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value),
  }));
  const currentAnswer = useFlowAnswersStore((s) =>
    currentNode?.type === "question" ? s.getAnswer(iterationCount, currentNode.id) : undefined,
  );
  const isInstructionOrQuestion =
    currentNode?.type === "instruction" || currentNode?.type === "question";

  // Show navigation buttons only for instruction/question nodes, not on the
  // submit/review screen. Branch nodes route automatically inside the runner
  // and never become the current node.
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
    useWorkbookFlowStore.getState().back();
  };

  const handleReturnToOverview = () => {
    Keyboard.dismiss();
    useWorkbookFlowStore.getState().returnToOverview();
  };

  const handleNextPress = () => {
    Keyboard.dismiss();
    // Questions commit their answer (ANSWER event); other nodes just advance.
    if (currentNode?.type === "question") {
      useWorkbookFlowStore.getState().commitAnswer(currentNode, currentAnswer ?? "");
    } else {
      useWorkbookFlowStore.getState().next();
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
