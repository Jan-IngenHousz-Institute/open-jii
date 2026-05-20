import { Throttler } from "@tanstack/pacer/throttler";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { countMeasurementsByStatus, getMeasurementsList } from "~/shared/db/measurements-storage";
import type {
  MeasurementCounts,
  MeasurementListRow,
  MeasurementStatus,
} from "~/shared/db/measurements-storage";

import { subscribeSettled } from "../services/upload-queue-state";

// Coalesce bursts of settled uploads into one refetch per window. The MQTT
// transport pool drains many items in parallel, so settle events arrive in
// bursts; a wider window means fewer FlashList re-renders and fewer lean
// SELECT round-trips per drained batch. List rows are lean (no decompress)
// so 500ms still feels real-time while flattening a 100-item burst from
// dozens of refetches to ~2.
const SETTLE_INVALIDATE_THROTTLE_MS = 500;

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
  // list and counts refresh as each item finishes. Pacer's Throttler gives
  // us leading + trailing edges with cancel-on-unmount in one line.
  useEffect(() => {
    const throttler = new Throttler(
      () => queryClient.invalidateQueries({ queryKey: ["measurements"] }),
      { wait: SETTLE_INVALIDATE_THROTTLE_MS, leading: true, trailing: true },
    );

    const unsubscribe = subscribeSettled(() => throttler.maybeExecute());

    return () => {
      throttler.cancel();
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

// One-shot lean fetch for callers that only need the first N rows (e.g. the
// home screen preview card). Avoids the full infinite query + its settle
// bridge so the home screen doesn't pay for pagination or burst refetches.
// Shares the `["measurements"]` key root so settle-invalidate still refreshes
// it.
export function useTopMeasurements(n: number) {
  const query = useQuery({
    queryKey: ["measurements", "top", n],
    queryFn: async () => {
      const rows = await getMeasurementsList(["pending", "failed", "successful"], {
        limit: n,
        offset: 0,
      });
      return rows.map((r) => ({ ...r, key: r.id }) as MeasurementItem);
    },
    networkMode: "always",
    refetchOnMount: true,
  });

  return { measurements: query.data ?? [] };
}
