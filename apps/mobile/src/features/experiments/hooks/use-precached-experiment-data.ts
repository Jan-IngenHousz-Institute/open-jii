import { useQuery, useQueryClient } from "@tanstack/react-query";
import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";

interface ExperimentRef {
  id: string;
  workbookId: string | null;
  workbookVersionId: string | null;
}

/** Reads the experiment's workbook refs from the already-cached list. */
function findExperimentRef(
  queryClient: ReturnType<typeof useQueryClient>,
  experimentId: string,
): ExperimentRef | undefined {
  const cached = queryClient.getQueryData<{ body?: ExperimentRef[] }>(contentKeys.experiments);
  return cached?.body?.find((e) => e.id === experimentId);
}

// Finite so an incomplete (offline/failed) precache can retry on reconnect.
const PRECACHE_STALE_TIME = 5 * 60 * 1000;

/**
 * Warms the offline cache for an experiment's flow by caching its workbook
 * version (cells + pinned command/macro snapshots). Throws if it can't, so the
 * precache reports incomplete and retries on reconnect.
 */
async function precacheExperimentWorkbookFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ workbookVersionId: string }> {
  let ref = findExperimentRef(queryClient, experimentId);
  if (!ref) {
    await queryClient.fetchQuery({
      queryKey: contentKeys.experiments,
      queryFn: () => tsr.experiments.listExperiments.query({ query: { filter: "member" } }),
      meta: { suppressToast: true },
    });
    ref = findExperimentRef(queryClient, experimentId);
  }

  if (!ref?.workbookId || !ref.workbookVersionId) {
    throw new Error(`No workbook version for experiment ${experimentId}`);
  }

  const { workbookId, workbookVersionId } = ref;
  await queryClient.fetchQuery({
    queryKey: ["workbook-version", workbookId, workbookVersionId],
    queryFn: () =>
      tsr.workbooks.getWorkbookVersion.query({
        params: { id: workbookId, versionId: workbookVersionId },
      }),
    meta: { suppressToast: true },
    // A pinned version is immutable, so reuse the cache instead of refetching
    // (a stale refetch would fail offline even with the version already cached).
    staleTime: Infinity,
  });

  return { workbookVersionId };
}

export function usePrecachedExperimentData(experimentId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["precache-experiment-data", experimentId],
    queryFn: () => precacheExperimentWorkbookFn(experimentId ?? "", queryClient),
    enabled: !!experimentId,
    meta: { suppressToast: true },
    staleTime: PRECACHE_STALE_TIME,
    gcTime: Infinity,
  });
}
