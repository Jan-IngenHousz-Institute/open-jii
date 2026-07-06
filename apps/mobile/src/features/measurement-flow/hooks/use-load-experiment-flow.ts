import { useEffect } from "react";
import { useWorkbookVersionQuery } from "~/features/experiments/hooks/use-experiment-flow-query";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { tsr } from "~/shared/api/tsr";

// Pre-loads an experiment's workbook (cells + entity snapshots) into the flow
// store while the picker is open; startFlow promotes it into a WorkbookRunner.
// Every experiment is workbook-backed; one without a workbook surfaces an error.
export function useLoadExperimentFlow(experimentId: string | undefined): {
  isLoading: boolean;
  error: unknown;
  isReady: boolean;
} {
  const prepareFlow = useWorkbookFlowStore((s) => s.prepareFlow);
  const clearPreparedFlow = useWorkbookFlowStore((s) => s.clearPreparedFlow);

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

  useEffect(() => {
    const body = versionData?.body;
    const cells = body?.cells;
    if (!cells) return;
    prepareFlow(cells, body?.entitySnapshots);
  }, [versionData, prepareFlow]);

  // The list resolved but the experiment has no workbook: every experiment is
  // workbook-backed, so surface an error rather than hang.
  const noWorkbook = !!experimentId && experimentsData != null && !hasWorkbook;

  const isReady = !!versionData?.body?.cells;

  // Clear a previously-prepared graph when this load fails, so startFlow can't
  // launch the prior experiment's cells.
  useEffect(() => {
    if (!isReady && (noWorkbook || versionError)) clearPreparedFlow();
  }, [isReady, noWorkbook, versionError, clearPreparedFlow]);

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
