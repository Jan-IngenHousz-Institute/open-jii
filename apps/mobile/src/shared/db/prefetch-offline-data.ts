import type { QueryClient } from "@tanstack/react-query";
import { tsr } from "~/shared/api/tsr";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("prefetch");

/**
 * Prefetches all experiment data needed for offline use.
 * Called after login (and on foreground/reconnect) so measurements run offline.
 */
export async function prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
): Promise<void> {
  try {
    await _prefetchOfflineData(queryClient, userId);
  } catch (err) {
    log.error("Failed to prefetch offline data", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function _prefetchOfflineData(queryClient: QueryClient, userId?: string): Promise<void> {
  // Kick off the profile prefetch in parallel; it's independent of experiments.
  // 404 is expected for accounts that haven't completed registration on web yet.
  const profilePromise = userId
    ? queryClient
        .prefetchQuery({
          queryKey: ["userProfile", userId],
          queryFn: () => tsr.users.getUserProfile.query({ params: { id: userId } }),
          staleTime: 0,
          meta: { suppressToast: true },
        })
        .catch((err) => {
          log.warn("user profile prefetch failed", {
            err: err instanceof Error ? err.message : String(err),
          });
        })
    : Promise.resolve();

  // 1. Fetch all user experiments.
  const experimentsResponse = await queryClient.fetchQuery({
    queryKey: ["experiments"],
    queryFn: () => tsr.experiments.listExperiments.query({ query: { filter: "member" } }),
    staleTime: 0,
  });

  const experiments = (experimentsResponse?.body ?? []) as {
    id: string;
    workbookId: string | null;
    workbookVersionId: string | null;
  }[];

  // 2. Cache each experiment's workbook version. The version carries everything
  //    the offline flow needs: cells (branch routing) and entitySnapshots
  //    (pinned protocol/macro code), so there are no per-asset fetches.
  const versionResults = await Promise.allSettled(
    experiments.map(async (experiment) => {
      const { workbookId, workbookVersionId } = experiment;
      if (!workbookId || !workbookVersionId) {
        throw new Error(`Experiment ${experiment.id} has no workbook version`);
      }
      await queryClient.fetchQuery({
        queryKey: ["workbook-version", workbookId, workbookVersionId],
        queryFn: () =>
          tsr.workbooks.getWorkbookVersion.query({
            params: { id: workbookId, versionId: workbookVersionId },
          }),
        staleTime: 0,
        meta: { suppressToast: true },
      });
    }),
  );

  const failures = versionResults.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (failures.length > 0) {
    log.warn("workbook version(s) failed to cache", {
      failures: failures.length,
      total: experiments.length,
      reasons: failures.map((r) => r.reason?.message ?? String(r.reason)),
    });
  }

  // Make sure the parallel profile prefetch has settled before returning.
  await profilePromise;

  log.info("cached", {
    experiments_cached: experiments.length - failures.length,
    experiments_total: experiments.length,
  });
}
