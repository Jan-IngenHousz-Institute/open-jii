import React from "react";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const { flowNodes, currentFlowStep, iterationCount, isFlowFinished, startNewIteration } =
    useMeasurementFlowStore();

  const isFlowCompleted = currentFlowStep >= flowNodes.length;

  const isFlowInitialized = flowNodes.length > 0;

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  if (isFlowCompleted && isFlowFinished) {
    return (
      <CompletedState
        iterationCount={iterationCount}
        onStartNew={() => {
          startNewIteration();
        }}
      />
    );
  }

  const currentNode = flowNodes[currentFlowStep];

  if (!currentNode) {
    return <EmptyState />;
  }

  return <ActiveState currentNode={currentNode} />;
}
