import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { countMeasurementsByStatus, getMeasurementsList } from "~/shared/db/measurements-storage";
import type {
  MeasurementCounts,
  MeasurementListRow,
  MeasurementStatus,
} from "~/shared/db/measurements-storage";

import { subscribeSettled } from "../services/upload-queue-state";

// Coalesce bursts of settled uploads (concurrency 8) into at most one
// refetch per 250ms — fast enough to feel real-time, cheap enough that a
// 100-item drain doesn't trigger 100 SQLite reads + decompresses.
const SETTLE_INVALIDATE_THROTTLE_MS = 250;

export type { MeasurementStatus } from "~/shared/db/measurements-storage";

// Re-exported under the previous name so existing call sites don't churn.
// The shape no longer carries the full `data.measurementResult` blob — the
// detail modal fetches it on demand via `getMeasurement(id)`.
export type MeasurementItem = MeasurementListRow & { key: string };

export type MeasurementFilter = "all" | "synced" | "unsynced";

const PAGE_SIZE = 50;

function statusesForFilter(filter: MeasurementFilter): MeasurementStatus[] {
  if (filter === "synced") return ["successful"];
  if (filter === "unsynced") return ["pending", "failed"];
  return ["pending", "failed", "successful"];
}

const EMPTY_COUNTS: MeasurementCounts = {
  pending: 0,
  failed: 0,
  successful: 0,
};

export function useAllMeasurements(filter: MeasurementFilter = "all") {
  const queryClient = useQueryClient();

  // Paginated lean fetch — first page (~1 ms locally) renders immediately.
  // `refetchOnMount: true` is safe now that the queryFn no longer decompresses.
  const listQuery = useInfiniteQuery({
    queryKey: ["measurements", "list", filter],
    queryFn: async ({ pageParam }) => {
      const rows = await getMeasurementsList(statusesForFilter(filter), {
        limit: PAGE_SIZE,
        offset: pageParam,
      });
      return rows.map((r) => ({ ...r, key: r.id }) as MeasurementItem);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return lastPageParam + PAGE_SIZE;
    },
    networkMode: "always",
    refetchOnMount: true,
  });

  const { data: counts = EMPTY_COUNTS } = useQuery({
    queryKey: ["measurements", "counts"],
    queryFn: countMeasurementsByStatus,
    networkMode: "always",
    refetchOnMount: true,
  });

  // Memoize the flattened page list so referentially-stable consumers
  // (FlatList, memoized child rows) don't re-render every parent render.
  const measurements = useMemo(() => listQuery.data?.pages.flat() ?? [], [listQuery.data?.pages]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  // Bridge from the in-memory upload queue to react-query: every time an
  // upload reaches a terminal state the DB row flips status, but the
  // storage layer doesn't know about react-query. Subscribe here so the
  // list and counts refresh as each item finishes.
  useEffect(() => {
    let lastInvalidatedAt = 0;
    let trailingTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      trailingTimer = null;
      lastInvalidatedAt = Date.now();
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
    };

    const unsubscribe = subscribeSettled(() => {
      const elapsed = Date.now() - lastInvalidatedAt;
      if (elapsed >= SETTLE_INVALIDATE_THROTTLE_MS) {
        flush();
        return;
      }
      trailingTimer ??= setTimeout(flush, SETTLE_INVALIDATE_THROTTLE_MS - elapsed);
    });

    return () => {
      if (trailingTimer !== null) clearTimeout(trailingTimer);
      unsubscribe();
    };
  }, [queryClient]);

  return {
    measurements,
    counts,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    invalidate,
  };
}
