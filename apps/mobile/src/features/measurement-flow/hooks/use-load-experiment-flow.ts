import { useEffect } from "react";
import { useWorkbookVersionQuery } from "~/features/experiments/hooks/use-experiment-flow-query";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";
import { tsr } from "~/shared/api/tsr";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

// Loads an experiment's workbook flow into the store: fetch the workbook version
// and derive the graph locally via cellsToFlowGraph (cells kept for branch eval).
// Every experiment is workbook-backed; one without a workbook surfaces an error.
export function useLoadExperimentFlow(experimentId: string | undefined): {
  isLoading: boolean;
  error: unknown;
  isReady: boolean;
} {
  const setFlowGraph = useMeasurementFlowStore((s) => s.setFlowGraph);
  const setFlowNodes = useMeasurementFlowStore((s) => s.setFlowNodes);

  // Shares the ["experiments"] cache key with useExperiments(), so this reads
  // from cache (no extra fetch) in the normal flow.
  const {
    data: experimentsData,
    isLoading: isExperimentsLoading,
    error: experimentsError,
  } = tsr.experiments.listExperiments.useQuery({
    queryKey: ["experiments"],
    queryData: { query: { filter: "member" } },
    enabled: !!experimentId,
  });

  const selected = experimentsData?.body?.find((e) => e.id === experimentId);
  const workbookId = selected?.workbookId ?? undefined;
  const workbookVersionId = selected?.workbookVersionId ?? undefined;
  const hasWorkbook = !!workbookId && !!workbookVersionId;

  const {
    data: versionData,
    isLoading: isVersionLoading,
    error: versionError,
  } = useWorkbookVersionQuery(workbookId, workbookVersionId);

  // Derive the graph in document order (preserve branches; don't collapse to a
  // single path) and hydrate each node so scan + upload read offline off it.
  useEffect(() => {
    const body = versionData?.body;
    const cells = body?.cells;
    if (!cells) return;
    const { nodes, edges } = cellsToFlowGraph(cells);
    setFlowGraph(hydrateFlowNodes(nodes, cells, body?.entitySnapshots), edges, cells);
  }, [versionData, setFlowGraph]);

  // The list resolved but the experiment has no workbook: every experiment is
  // workbook-backed, so surface an error rather than hang.
  const noWorkbook = !!experimentId && experimentsData != null && !hasWorkbook;

  const isReady = !!versionData?.body?.cells;

  // Clear a previously-loaded graph when this load fails, so consumers don't keep
  // rendering the prior experiment's nodes.
  useEffect(() => {
    if (!isReady && (noWorkbook || versionError)) setFlowNodes([]);
  }, [isReady, noWorkbook, versionError, setFlowNodes]);

  const isLoading =
    !noWorkbook &&
    (isExperimentsLoading ||
      isVersionLoading ||
      (!!experimentId && experimentsData == null && !experimentsError));
  const error =
    experimentsError ??
    versionError ??
    (noWorkbook ? new Error(`Experiment ${experimentId} has no workbook version`) : undefined);

  return { isLoading, error, isReady };
}
