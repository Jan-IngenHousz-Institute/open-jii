import React from "react";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const { flowNodes, currentFlowStep, iterationCount, isFlowFinished, resetFlow, finishFlow } =
    useMeasurementFlowStore();

  const isFlowCompleted = currentFlowStep >= flowNodes.length;

  const isFlowInitialized = flowNodes.length > 0;

  // Flow nodes are initialized from the experiment selection step's handler

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  if (isFlowCompleted && isFlowFinished) {
    return (
      <CompletedState
        iterationCount={iterationCount}
        onStartNew={() => {
          resetFlow();
        }}
      />
    );
  }

  const currentNode = flowNodes[currentFlowStep];

  if (!currentNode) {
    return <EmptyState />;
  }

  return (
    <ActiveState
      currentNode={currentNode}
      currentFlowStep={currentFlowStep}
      flowNodesLength={flowNodes.length}
      iterationCount={iterationCount}
    />
  );
}
