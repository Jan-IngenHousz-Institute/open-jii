import type { QueryClient } from "@tanstack/react-query";
import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("prefetch");

let inFlight: Promise<void> | null = null;
let lastRunAt = 0;
const MIN_RERUN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Prefetches all experiment data needed for offline use. Called after login and
 * (throttled) on foreground/reconnect so a precache left incomplete while
 * offline heals without a re-login. Concurrent calls share the in-flight run.
 */
export async function prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
  options?: { throttle?: boolean },
): Promise<void> {
  if (inFlight) return inFlight;
  if (options?.throttle && Date.now() - lastRunAt < MIN_RERUN_INTERVAL_MS) return;

  inFlight = (async () => {
    try {
      const { failures } = await _prefetchOfflineData(queryClient, userId);
      // Only a fully-successful run counts as "recent"; a partial run stays
      // eligible for an immediate retry on the next reconnect/foreground.
      if (failures === 0) lastRunAt = Date.now();
    } catch (err) {
      log.error("Failed to prefetch offline data", {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function _prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
): Promise<{ failures: number }> {
  // 404 is expected for accounts that haven't finished web registration.
  const profilePromise = userId
    ? queryClient
        .prefetchQuery({
          queryKey: contentKeys.userProfile(userId),
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

  const experimentsResponse = await queryClient.fetchQuery({
    queryKey: contentKeys.experiments,
    queryFn: () => tsr.experiments.listExperiments.query({ query: { filter: "member" } }),
    staleTime: 0,
    // Reachable from a background reconnect/foreground refetch; stay silent.
    meta: { suppressToast: true },
  });

  // The contract response shape can vary (paginated envelope, error body, or a
  // bare array); only an actual array is iterable, so guard before `.map` to
  // avoid "experiments.map is not a function" crashes seen in production.
  const experiments = (
    Array.isArray(experimentsResponse?.body) ? experimentsResponse.body : []
  ) as {
    id: string;
    workbookId: string | null;
    workbookVersionId: string | null;
  }[];

  // Cache each workbook version (cells + pinned snapshots); no per-asset fetches.
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
        // Immutable pinned version: reuse the cache rather than refetch.
        staleTime: Infinity,
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

  await profilePromise;

  log.info("cached", {
    experiments_cached: experiments.length - failures.length,
    experiments_total: experiments.length,
  });

  return { failures: failures.length };
}
