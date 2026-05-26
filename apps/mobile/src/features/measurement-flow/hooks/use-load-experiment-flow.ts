import { useEffect } from "react";
import {
  useExperimentFlowQuery,
  useWorkbookVersionQuery,
} from "~/features/experiments/hooks/use-experiment-flow-query";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { orderFlowNodes } from "~/features/measurement-flow/utils/order-flow-nodes";
import { tsr } from "~/shared/api/tsr";

import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";

// Loads an experiment's flow into the store. Workbook-backed experiments fetch
// the workbook version and derive the graph locally via the shared
// `cellsToFlowGraph` (replacing the getFlow call, keeping cells for branch
// eval); others fall back to the legacy getFlow path (branch-free).
export function useLoadExperimentFlow(experimentId: string | undefined): {
  isLoading: boolean;
  error: unknown;
  isReady: boolean;
} {
  const setFlowGraph = useMeasurementFlowStore((s) => s.setFlowGraph);
  const setFlowNodes = useMeasurementFlowStore((s) => s.setFlowNodes);

  // Shares the ["experiments"] cache key with useExperiments(), so this reads
  // from cache (no extra fetch) in the normal flow.
  const { data: experimentsData, isLoading: isExperimentsLoading } =
    tsr.experiments.listExperiments.useQuery({
      queryKey: ["experiments"],
      queryData: { query: { filter: "member" } },
      enabled: !!experimentId,
    });

  const selected = experimentsData?.body?.find((e) => e.id === experimentId);
  const workbookId = selected?.workbookId ?? undefined;
  const workbookVersionId = selected?.workbookVersionId ?? undefined;
  const hasWorkbook = !!workbookId && !!workbookVersionId;

  // Only fall back to the legacy flow once we positively know there is no
  // workbook to read (the experiment list has resolved without one).
  const useFlowFallback = !!experimentId && experimentsData != null && !hasWorkbook;

  const {
    data: versionData,
    isLoading: isVersionLoading,
    error: versionError,
  } = useWorkbookVersionQuery(workbookId, workbookVersionId);

  const {
    data: flowData,
    isLoading: isFlowLoading,
    error: flowError,
  } = useExperimentFlowQuery(experimentId, useFlowFallback);

  // Workbook path: derive the graph locally in document order (NOT orderFlowNodes,
  // which collapses branches by following only the first outgoing edge).
  useEffect(() => {
    const cells = versionData?.body?.cells;
    if (!cells) return;
    const { nodes, edges } = cellsToFlowGraph(cells);
    setFlowGraph(nodes, edges, cells);
  }, [versionData, setFlowGraph]);

  // Legacy path: linearize the stored flow graph (branch-free).
  useEffect(() => {
    if (hasWorkbook) return;
    if (!flowData?.body?.graph) return;
    const { nodes = [], edges = [] } = flowData.body.graph;
    setFlowNodes(orderFlowNodes(nodes, edges));
  }, [hasWorkbook, flowData, setFlowNodes]);

  const isReady = hasWorkbook ? !!versionData?.body?.cells : !!flowData?.body?.graph;
  const isLoading = hasWorkbook
    ? isVersionLoading
    : isExperimentsLoading || isFlowLoading || (!!experimentId && experimentsData == null);
  const error = hasWorkbook ? versionError : flowError;

  return { isLoading, error, isReady };
}
