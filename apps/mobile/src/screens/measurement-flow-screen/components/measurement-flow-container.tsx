import clsx from "clsx";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import type { QuestionContent } from "../types";
import { ExperimentSelectionStep } from "./experiment-selection-step";
import { QuestionsOnlySubmitNode } from "./flow-nodes/questions-only-submit-node";
import { findNextMandatoryStep } from "./flow-nodes/utils/advance-with-answer";
import { FlowProgressIndicator } from "./flow-progress-indicator";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const {
    flowNodes,
    currentFlowStep,
    isFlowFinished,
    isQuestionsSubmitPending,
    setCurrentFlowStep,
    experimentId,
  } = useMeasurementFlowStore();
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const { classes } = useTheme();
  const isFlowCompleted = currentFlowStep >= flowNodes.length;
  const isFlowInitialized = flowNodes.length > 0;
  const currentNode = flowNodes[currentFlowStep];

  // On each new iteration, carry forward remembered/auto-incremented answers from the
  // previous iteration and jump to the first step that still needs manual input.
  useEffect(() => {
    if (iterationCount === 0 || flowNodes.length === 0) return;

    const { getAnswer, setAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } =
      useFlowAnswersStore.getState();

    for (const node of flowNodes) {
      if (node.type !== "question") continue;
      const content = node.content as QuestionContent | undefined;
      if (!content) continue;
      if (getAnswer(iterationCount, node.id)?.trim()) continue;

      const previous = getAnswer(iterationCount - 1, node.id)?.trim();
      if (!previous) continue;

      if (content.kind === "multi_choice" && isAutoincrementEnabled(node.id)) {
        const options = content.options ?? [];
        if (!options.length) continue;
        const idx = options.indexOf(previous);
        if (idx < 0) continue;
        setAnswer(iterationCount, node.id, options[(idx + 1) % options.length]);
        continue;
      }

      if (isRememberAnswerEnabled(node.id)) {
        setAnswer(iterationCount, node.id, previous);
      }
    }

    const first = findNextMandatoryStep(-1, flowNodes, iterationCount);
    setCurrentFlowStep(first < flowNodes.length ? first : 0);
  }, [iterationCount, flowNodes, setCurrentFlowStep]);

  // Show experiment selection if no experiment is selected yet
  if (!experimentId) {
    return (
      <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
        <FlowProgressIndicator />
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
        <FlowProgressIndicator />
        <QuestionsOnlySubmitNode />
      </View>
    );
  }

  if (isFlowCompleted && isFlowFinished) {
    return (
      <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
        <FlowProgressIndicator />
        <CompletedState />
      </View>
    );
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  return (
    <View className={clsx("flex-1 rounded-t-3xl", classes.card)}>
      <FlowProgressIndicator />
      <ActiveState currentNode={currentNode} />
    </View>
  );
}
