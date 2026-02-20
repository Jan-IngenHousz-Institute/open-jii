import React, { useEffect } from "react";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";
import { QuestionsOverview } from "./flow-states/questions-overview";

export function MeasurementFlowContainer() {
  const {
    flowNodes,
    currentFlowStep,
    isFlowFinished,
    showingOverview,
    returnToOverviewAfterEdit,
    nextStep,
  } = useMeasurementFlowStore();
  const { getAnswer } = useFlowAnswersStore();
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);

  const isFlowCompleted = currentFlowStep >= flowNodes.length;

  const isFlowInitialized = flowNodes.length > 0;

  const currentNode = flowNodes[currentFlowStep];
  const currentAnswer =
    currentNode?.type === "question" ? getAnswer(iterationCount, currentNode.id) : undefined;
  const shouldSkipQuestion =
    !showingOverview &&
    !returnToOverviewAfterEdit &&
    currentNode?.type === "question" &&
    !!currentAnswer?.trim();

  useEffect(() => {
    if (shouldSkipQuestion) {
      nextStep();
    }
  }, [shouldSkipQuestion, nextStep]);

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  if (isFlowCompleted && isFlowFinished) {
    return <CompletedState />;
  }

  if (showingOverview) {
    return <QuestionsOverview />;
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  return <ActiveState currentNode={currentNode} />;
}
