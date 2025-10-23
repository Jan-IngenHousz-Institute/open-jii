import React from "react";
import { useExperimentFlow } from "~/hooks/use-experiment-flow";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { ErrorState } from "./flow-states/error-state";
import { LoadingState } from "./flow-states/loading-state";
import { ReadyState } from "./flow-states/ready-state";

export function CustomMeasurementFlowStep() {
  const { experimentId, flowNodes, currentFlowStep, isFlowCompleted, setFlowNodes, nextStep } =
    useMeasurementFlowStore();

  const { data: { body } = {}, isLoading, error } = useExperimentFlow(experimentId);

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

  if (isFlowCompleted) {
    return <CompletedState />;
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
      onNext={nextStep}
    />
  );
}
