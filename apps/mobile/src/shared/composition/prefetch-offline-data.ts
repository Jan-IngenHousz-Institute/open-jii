import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";
import { createLogger } from "~/shared/observability/logger";
import { trackProductEvent } from "~/shared/observability/product-events";

import { listItems } from "@repo/api/shared/listing";

const log = createLogger("prefetch");

const runs = new WeakMap<QueryClient, { inFlight: Promise<void> | null; lastRunAt: number }>();

const MIN_RERUN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Prefetches all experiment data needed for offline use. Called after login and
 * (throttled) on foreground/reconnect so a precache left incomplete while
 * offline heals without a re-login. Concurrent calls share the in-flight run.
 */
export async function prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
  options?: { throttle?: boolean; isGuest?: boolean },
): Promise<void> {
  let state = runs.get(queryClient);
  if (!state) {
    state = { inFlight: null, lastRunAt: 0 };
    runs.set(queryClient, state);
  }
  if (state.inFlight) return state.inFlight;
  if (options?.throttle && Date.now() - state.lastRunAt < MIN_RERUN_INTERVAL_MS) return;

  state.inFlight = (async () => {
    try {
      const { failures } = await _prefetchOfflineData(
        queryClient,
        options?.isGuest ? undefined : userId,
      );
      // Only a fully-successful run counts as "recent"; a partial run stays
      // eligible for an immediate retry on the next reconnect/foreground.
      if (failures === 0) state.lastRunAt = Date.now();
      trackProductEvent("offline_data:prefetch_finish", {
        status: failures === 0 ? "ok" : "partial",
        failures,
      });
    } catch (err) {
      log.error("Failed to prefetch offline data", {
        err: err instanceof Error ? err.message : String(err),
      });
      trackProductEvent("offline_data:prefetch_finish", { status: "failed", failures: 0 });
    } finally {
      state.inFlight = null;
    }
  })();

  return state.inFlight;
}

async function _prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
): Promise<{ failures: number }> {
  // 404 is expected for accounts that haven't finished web registration.
  const profilePromise = userId
    ? queryClient
        .prefetchQuery(
          orpc.users.getUserProfile.queryOptions({
            input: { id: userId },
            staleTime: 0,
            meta: { suppressToast: true },
          }),
        )
        .catch((err) => {
          log.warn("user profile prefetch failed", {
            err: err instanceof Error ? err.message : String(err),
          });
        })
    : Promise.resolve();

  const experimentsResponse = await queryClient.fetchQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { scope: "related" },
      staleTime: 0,
      // Reachable from a background reconnect/foreground refetch; stay silent.
      meta: { suppressToast: true },
    }),
  );

  const experiments = listItems(experimentsResponse);

  // Cache each workbook version (cells + pinned snapshots); no per-asset fetches.
  const versionResults = await Promise.allSettled(
    experiments.map(async (experiment) => {
      const { workbookId, workbookVersionId } = experiment;
      if (!workbookId || !workbookVersionId) {
        throw new Error(`Experiment ${experiment.id} has no workbook version`);
      }
      await queryClient.fetchQuery(
        orpc.workbooks.getWorkbookVersion.queryOptions({
          input: { id: workbookId, versionId: workbookVersionId },
          // Immutable pinned version: reuse the cache rather than refetch.
          staleTime: Infinity,
          meta: { suppressToast: true },
        }),
      );
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
