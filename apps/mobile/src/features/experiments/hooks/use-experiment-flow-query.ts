import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

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
  return useQuery(
    orpc.workbooks.getWorkbookVersion.queryOptions({
      input: { id: workbookId ?? "", versionId: workbookVersionId ?? "" },
      enabled: !!workbookId && !!workbookVersionId,
      networkMode: "offlineFirst",
    }),
  );
}
