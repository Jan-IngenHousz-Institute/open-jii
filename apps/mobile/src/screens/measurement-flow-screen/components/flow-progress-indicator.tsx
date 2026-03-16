import { clsx } from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "~/hooks/use-theme";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { isQuestionsOnlyFlow } from "~/screens/measurement-flow-screen/types";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

export function FlowProgressIndicator() {
  const { classes } = useTheme();
  const { currentFlowStep, flowNodes, experimentId, isQuestionsSubmitPending, isFlowFinished } =
    useMeasurementFlowStore();
  const { selectedExperimentId } = useExperimentSelectionStore();

  const questionsOnly = isQuestionsOnlyFlow(flowNodes);

  // +1 for experiment selection, +1 for completed state of the flow,
  // and +1 extra step for the questions-only submit screen (if applicable).
  const totalSteps = flowNodes.length + (questionsOnly ? 3 : 2);

  let currentStep: number;
  if (!experimentId) {
    currentStep = 1;
  } else if (questionsOnly) {
    if (isQuestionsSubmitPending) {
      // Submit/review answers screen, just after the last question
      currentStep = flowNodes.length + 2;
    } else if (isFlowFinished && currentFlowStep >= flowNodes.length) {
      // Completed state after the submit step
      currentStep = flowNodes.length + 3;
    } else {
      // Within the question flow
      currentStep = currentFlowStep + 2;
    }
  } else {
    const isCompleted = isFlowFinished && currentFlowStep >= flowNodes.length;
    currentStep = isCompleted ? flowNodes.length + 2 : currentFlowStep + 2;
  }

  const progress = useSharedValue(0);

  // Animate whenever step changes
  useEffect(() => {
    const percentage = currentStep / totalSteps;

    progress.value = withTiming(percentage, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStep, progress, totalSteps]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  // Hide the bar when on experiment selection and no experiment is selected
  if (!selectedExperimentId) {
    return null;
  }

  return (
    <View className="px-4 pt-6">
      <View className="flex-row items-center justify-between">
        <View className={clsx("h-2.5 flex-1 rounded-full", classes.surface)}>
          <Animated.View style={[{ height: "100%" }, animatedStyle]}>
            <LinearGradient
              colors={["#FBF8C1", "#005E5E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 40 }}
            />
          </Animated.View>
        </View>

        <Text className="ml-3 text-sm">
          {currentStep}/{totalSteps}
        </Text>
      </View>
    </View>
  );
}
