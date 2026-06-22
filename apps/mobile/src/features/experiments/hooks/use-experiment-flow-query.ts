import { tsr } from "~/shared/api/tsr";

export function useExperimentFlowQuery(experimentId: string | undefined, enabled = true) {
  return tsr.experiments.getFlow.useQuery({
    queryKey: ["experiment-flow", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: enabled && !!experimentId,
    networkMode: "offlineFirst",
  });
}

/**
 * Loads a published workbook version (with full cell data, including branch
 * conditions) for an experiment that has a workbook attached. Used by the
 * measurement-flow loader to derive the flow graph locally and to evaluate
 * branch cells on-device. The query key matches the prefetch/precache writers
 * so it is served from the persisted offline cache when present.
 */
export function useWorkbookVersionQuery(
  workbookId: string | undefined,
  workbookVersionId: string | undefined,
) {
  return tsr.workbooks.getWorkbookVersion.useQuery({
    queryKey: ["workbook-version", workbookId, workbookVersionId],
    queryData: { params: { id: workbookId ?? "", versionId: workbookVersionId ?? "" } },
    enabled: !!workbookId && !!workbookVersionId,
    networkMode: "offlineFirst",
  });
}
