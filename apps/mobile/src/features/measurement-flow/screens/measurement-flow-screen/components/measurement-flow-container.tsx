import clsx from "clsx";
import React from "react";
import { View } from "react-native";
import { useIterationStateSync } from "~/features/measurement-flow/hooks/use-iteration-state-sync";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { ExperimentSelectionStep } from "./experiment-selection-step";
import { QuestionsOnlySubmitNode } from "./flow-nodes/questions-only-submit-node";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const { flowNodes, currentFlowStep, isFlowFinished, isQuestionsSubmitPending, experimentId } =
    useMeasurementFlowStore();
  const { classes } = useTheme();
  const isFlowCompleted = currentFlowStep >= flowNodes.length;
  const isFlowInitialized = flowNodes.length > 0;
  const currentNode = flowNodes[currentFlowStep];

  useIterationStateSync(flowNodes);

  // Show experiment selection if no experiment is selected yet
  if (!experimentId) {
    return (
      <View className={clsx("flex-1", classes.card)}>
        <ExperimentSelectionStep />
      </View>
    );
  }

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  if (isQuestionsSubmitPending) {
    return (
      <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
        <QuestionsOnlySubmitNode />
      </View>
    );
  }

  if (isFlowCompleted && isFlowFinished) {
    return (
      <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
        <CompletedState />
      </View>
    );
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  return (
    <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
      <ActiveState currentNode={currentNode} />
    </View>
  );
}
