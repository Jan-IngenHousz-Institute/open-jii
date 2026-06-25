import type { QueryClient } from "@tanstack/react-query";
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
      await _prefetchOfflineData(queryClient, userId);
      lastRunAt = Date.now();
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

async function _prefetchOfflineData(queryClient: QueryClient, userId?: string): Promise<void> {
  // 404 is expected for accounts that haven't finished web registration.
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

  await profilePromise;

  log.info("cached", {
    experiments_cached: experiments.length - failures.length,
    experiments_total: experiments.length,
  });
}
