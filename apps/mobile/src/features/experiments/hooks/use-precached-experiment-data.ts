import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const cached = queryClient.getQueryData<{ body?: ExperimentRef[] }>(["experiments"]);
  return cached?.body?.find((e) => e.id === experimentId);
}

// Refetch window: a successful precache won't churn on reconnect, but a
// stale/failed one becomes eligible to retry once online (with refetchOnReconnect).
const PRECACHE_STALE_TIME = 5 * 60 * 1000;

/**
 * Warms the offline cache for an experiment's measurement flow. The workbook
 * version carries everything the flow needs offline: cells (branch routing) and
 * entitySnapshots (pinned protocol/macro code), so there are no per-protocol or
 * per-macro fetches. Throws if the version can't be resolved/cached so the
 * precache reports incomplete and retries on reconnect.
 */
async function precacheExperimentWorkbookFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ workbookVersionId: string }> {
  let ref = findExperimentRef(queryClient, experimentId);
  if (!ref) {
    // The experiments list isn't cached yet; fetch it so we can resolve the ref.
    await queryClient.fetchQuery({
      queryKey: ["experiments"],
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
  });

  return { workbookVersionId };
}

export function usePrecachedExperimentData(experimentId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["precache-experiment-data", experimentId],
    queryFn: () => precacheExperimentWorkbookFn(experimentId ?? "", queryClient),
    enabled: !!experimentId,
    // Incomplete precache (offline/failed) is expected and retried on reconnect;
    // don't blare a technical toast.
    meta: { suppressToast: true },
    // Finite (not Infinity) so an incomplete precache becomes eligible to refetch
    // when connectivity returns.
    staleTime: PRECACHE_STALE_TIME,
    gcTime: Infinity,
  });
}
