import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { countMeasurementsByStatus, getMeasurementsList } from "~/shared/db/measurements-storage";
import type { MeasurementCounts } from "~/shared/db/measurements-storage";

import { queryKeys, statusesForFilter } from "../services/measurement-list-cache";
import type { MeasurementFilter, MeasurementItem } from "../services/measurement-list-cache";

export type { MeasurementStatus } from "~/shared/db/measurements-storage";
export type { MeasurementFilter, MeasurementItem } from "../services/measurement-list-cache";

const PAGE_SIZE = 50;

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
    queryKey: queryKeys.list(filter),
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
    // Re-read SQLite when the app returns to the foreground (RN's equivalent
    // of window focus, wired via focusManager → AppState). Keeps the cached
    // list instant on resume but refreshes it without a sign-out/in. OJD.
    refetchOnWindowFocus: true,
  });

  // Memoize the flattened page list so referentially-stable consumers
  // (FlatList, memoized child rows) don't re-render every parent render.
  const measurements = useMemo(() => listQuery.data?.pages.flat() ?? [], [listQuery.data?.pages]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.root });
  };

  return {
    measurements,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    invalidate,
  };
}

// Counts live in their own subscription, separate from the list query, so the
// components that show them (the toolbar badges) re-render on settle ticks
// WITHOUT dragging the heavy Recent list + FlashList subtree into every
// re-render. See OJD-1470.
export function useMeasurementCounts() {
  const { data: counts = EMPTY_COUNTS } = useQuery({
    queryKey: queryKeys.counts,
    queryFn: countMeasurementsByStatus,
    networkMode: "always",
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  return {
    counts,
    syncedCount: counts.successful,
    unsyncedCount: counts.pending + counts.failed,
    totalCount: counts.pending + counts.failed + counts.successful,
  };
}

// Boolean "is there anything at all" selector. `select` returns a primitive,
// so React Query only notifies when it FLIPS — pending→successful settles keep
// the total constant, so the subscriber never re-renders on a tick.
export function useHasAnyMeasurements(): boolean {
  return (
    useQuery({
      queryKey: queryKeys.counts,
      queryFn: countMeasurementsByStatus,
      select: (c) => c.pending + c.failed + c.successful > 0,
      networkMode: "always",
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }).data ?? false
  );
}

// One-shot lean fetch for callers that only need the first N rows (e.g. the
// home screen preview card). Avoids the full infinite query so the home
// screen doesn't pay for pagination or burst refetches. Shares the
// `["measurements"]` key root so invalidations still refresh it.
export function useTopMeasurements(n: number) {
  const query = useQuery({
    queryKey: queryKeys.top(n),
    queryFn: async () => {
      const rows = await getMeasurementsList(statusesForFilter("all"), {
        limit: n,
        offset: 0,
      });
      return rows.map((r) => ({ ...r, key: r.id }) as MeasurementItem);
    },
    networkMode: "always",
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return { measurements: query.data ?? [] };
}
