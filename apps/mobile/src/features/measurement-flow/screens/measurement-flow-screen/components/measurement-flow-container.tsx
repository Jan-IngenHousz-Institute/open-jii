import React from "react";
import { View } from "react-native";
import { useIterationStateSync } from "~/features/measurement-flow/hooks/use-iteration-state-sync";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { ExperimentSelectionStep } from "./experiment-selection-step";
import { QuestionsOnlySubmitNode } from "./flow-nodes/questions-only-submit-node";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const { flowNodes, currentFlowStep, isFlowFinished, isQuestionsSubmitPending, experimentId } =
    useMeasurementFlowStore();
  const isFlowCompleted = currentFlowStep >= flowNodes.length;
  const isFlowInitialized = flowNodes.length > 0;
  const currentNode = flowNodes[currentFlowStep];

  useIterationStateSync(flowNodes);

  // Picker — flat against the screen background.
  if (!experimentId) {
    return (
      <View className="bg-background flex-1">
        <ExperimentSelectionStep />
      </View>
    );
  }

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  // Active flow states sit under the FlowHero with a rounded "card" lip.
  if (isQuestionsSubmitPending) {
    return (
      <View className="bg-card flex-1 rounded-t-3xl">
        <QuestionsOnlySubmitNode />
      </View>
    );
  }

  if (isFlowCompleted && isFlowFinished) {
    return (
      <View className="bg-card flex-1 rounded-t-3xl">
        <CompletedState />
      </View>
    );
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  return (
    <View className="bg-card flex-1 rounded-t-3xl">
      <ActiveState currentNode={currentNode} />
    </View>
  );
}
