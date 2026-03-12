/* eslint-disable @typescript-eslint/no-require-imports */
import { useHeaderHeight } from "@react-navigation/elements";
import { useIsFocused } from "@react-navigation/native";
import clsx from "clsx";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Image, View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { EndFlowButton } from "./components/end-flow-button";
import { MeasurementFlowContainer } from "./components/measurement-flow-container";
import { NavigationButtons } from "./components/navigation-buttons";

function getStepLabel(
  experimentId: string | undefined,
  currentFlowStep: number,
  flowNodes: any[],
  isFlowFinished: boolean,
): string {
  // No experiment selected yet
  if (!experimentId) {
    return "Choose an experiment to begin your experiment workflow.";
  }

  // Flow completed
  const isFlowCompleted = currentFlowStep >= flowNodes.length;
  if (isFlowCompleted && isFlowFinished) {
    return "Check your recent measurements before you continue the flow.";
  }

  // Get current node and show its name/type
  const currentNode = flowNodes[currentFlowStep];
  if (!currentNode) {
    return "";
  }

  // You can customize these labels based on node type
  switch (currentNode.type) {
    case "instruction":
      return "Read these instructions carefully.";
    case "question":
      return "Answer the questions below to continue to do the measurement.";
    case "measurement":
      return "Below you can see and edit the answers given in the questions.";
    case "analysis":
      return "Check out the measurement data and accept or discard.";
    default:
      return currentNode.name;
  }
}

interface MeasurementFlowScreenProps {
  /** Called after flow is ended (e.g. to navigate back to landing) */
  onEndFlowComplete?: () => void;
}

export function MeasurementFlowScreen({ onEndFlowComplete }: MeasurementFlowScreenProps = {}) {
  useKeepAwake();
  const { classes } = useTheme();
  const { resetFlow, flowNodes, currentFlowStep, isFlowFinished, experimentId } =
    useMeasurementFlowStore();
  const { clearHistory } = useFlowAnswersStore();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();

  const handleEndFlow = () => {
    resetFlow();
    clearHistory();
    onEndFlowComplete?.();
  };

  // Get the dynamic step label
  const stepLabel = getStepLabel(experimentId, currentFlowStep, flowNodes, isFlowFinished);
  const shouldShowEndFlowButton = !!experimentId;

  return (
    <View className={clsx("flex-1", classes.background)}>
      {isFocused && <StatusBar style="light" />}

      {/* Background */}
      <Image
        source={require("../../../assets/flow-header.png")}
        style={{
          position: "absolute",
          width: "100%",
          height: "30%",
        }}
        resizeMode="cover"
      />

      <LinearGradient
        colors={["rgba(0,0,0,1)", "rgba(0,0,0,0.75)", "rgba(0,0,0,0.4)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
      />

      {/* Foreground content */}
      <View
        className="flex-1"
        style={{
          paddingTop: headerHeight,
        }}
      >
        {shouldShowEndFlowButton && (
          <View className="mb-4 flex-row items-end px-4">
            <Text className="mr-2 flex-1 text-lg text-white">{stepLabel}</Text>
            <EndFlowButton onPress={handleEndFlow} />
          </View>
        )}

        {!shouldShowEndFlowButton && (
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-lg text-white">{stepLabel}</Text>
            <View />
          </View>
        )}

        <MeasurementFlowContainer />

        <NavigationButtons />
      </View>
    </View>
  );
}
