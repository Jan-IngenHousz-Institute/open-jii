import React from "react";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FormValidationProvider } from "../hooks/use-form-validation";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { ErrorState } from "./flow-states/error-state";
import { LoadingState } from "./flow-states/loading-state";

export function MeasurementFlowContainer() {
  const {
    experimentId,
    flowNodes,
    currentFlowStep,
    iterationCount,
    isFlowFinished,
    setFlowNodes,
    nextStep,
    startNewIteration,
    retryCurrentIteration,
    finishFlow,
    resetFlow,
  } = useMeasurementFlowStore();

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
    <FormValidationProvider>
      <ActiveState
        currentNode={currentNode}
        currentFlowStep={currentFlowStep}
        flowNodesLength={flowNodes.length}
        iterationCount={iterationCount}
      />
    </FormValidationProvider>
  );
}
