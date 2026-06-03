import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIterationStateSync } from "~/features/measurement-flow/hooks/use-iteration-state-sync";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { ExperimentSelectionStep } from "./experiment-selection-step";
import { QuestionsOnlySubmitNode } from "./flow-nodes/questions-only-submit-node";
import { ActiveState } from "./flow-states/active-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const { flowNodes, currentFlowStep, isQuestionsSubmitPending, experimentId } =
    useMeasurementFlowStore();
  const isFlowInitialized = flowNodes.length > 0;
  const currentNode = flowNodes[currentFlowStep];
  const insets = useSafeAreaInsets();

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
      <View
        className="bg-card flex-1 rounded-t-[36px] pt-3"
        style={{ paddingBottom: insets.bottom }}
      >
        <QuestionsOnlySubmitNode />
      </View>
    );
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  // Instruction/question nodes show the NavigationButtons bar, which carries
  // its own bottom inset. Measurement/analysis nodes render their own action
  // bar instead, so the card must supply the inset for those.
  const navButtonsCarryInset =
    currentNode.type === "instruction" || currentNode.type === "question";

  return (
    <View
      className="bg-card flex-1 rounded-t-[36px] pt-3"
      style={{ paddingBottom: navButtonsCarryInset ? 0 : insets.bottom }}
    >
      <ActiveState currentNode={currentNode} />
    </View>
  );
}
