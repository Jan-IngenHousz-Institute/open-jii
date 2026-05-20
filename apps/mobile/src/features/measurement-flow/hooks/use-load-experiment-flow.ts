import { useEffect } from "react";
import { useExperimentFlowQuery } from "~/features/experiments/hooks/use-experiment-flow-query";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { orderFlowNodes } from "~/shared/utils/order-flow-nodes";

/**
 * Loads the experiment flow for the given experimentId and pushes the
 * ordered flow nodes into the measurement-flow store as soon as the
 * underlying query resolves.
 *
 * Returns the loading state so callers can render the appropriate spinner /
 * error UI. Previously the conversion + store-sync lived as a useEffect
 * inline in experiment-selection-step.tsx, which forced that component to
 * orchestrate query data + store writes alongside its 8 other hooks.
 */
export function useLoadExperimentFlow(experimentId: string | undefined): {
  isLoading: boolean;
  error: unknown;
  isReady: boolean;
} {
  const { data, isLoading, error } = useExperimentFlowQuery(experimentId);
  const setFlowNodes = useMeasurementFlowStore((s) => s.setFlowNodes);

  useEffect(() => {
    if (!data?.body?.graph) return;
    const { nodes = [], edges = [] } = data.body.graph;
    setFlowNodes(orderFlowNodes(nodes, edges));
  }, [data, setFlowNodes]);

  return {
    isLoading,
    error,
    isReady: !!data?.body?.graph,
  };
}
