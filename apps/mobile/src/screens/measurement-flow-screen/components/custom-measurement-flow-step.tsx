import React from "react";
import { useExperimentFlow } from "~/hooks/use-experiment-flow";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FormValidationProvider } from "../hooks/use-form-validation";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { ErrorState } from "./flow-states/error-state";
import { LoadingState } from "./flow-states/loading-state";
import { ReadyState } from "./flow-states/ready-state";

export function CustomMeasurementFlowStep() {
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

  const { data: { body } = {}, isLoading, error } = useExperimentFlow(experimentId);
  console.log("body", body);

  const isFlowInitialized = flowNodes.length > 0;

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState />;
  }

  if (!isFlowInitialized && body) {
    return <ReadyState onStartFlow={() => setFlowNodes(body.graph.nodes)} />;
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
        onNext={nextStep}
        onUpload={() => {
          console.log("Upload clicked");
          startNewIteration();
        }}
        onRetry={retryCurrentIteration}
        onFinish={() => {
          console.log("Finish flow clicked");
          finishFlow();
        }}
      />
    </FormValidationProvider>
  );
}
