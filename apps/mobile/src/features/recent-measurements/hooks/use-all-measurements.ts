import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  countMeasurementsByStatus,
  getMeasurementById,
  getMeasurementsList,
} from "~/shared/db/measurements-storage";
import type {
  MeasurementCounts,
  MeasurementListRow,
  MeasurementStatus,
} from "~/shared/db/measurements-storage";

import { subscribeSettled } from "../services/outbox-state";

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

  // Bridge from the Outbox to react-query: every time an upload reaches a
  // terminal state surgically patch the cached row instead of invalidating
  // the whole `["measurements"]` key. Invalidate refetched every loaded
  // page + counts + pending-or-failed on a 500 ms throttle — under a
  // 100-item burst that's dozens of SQL round-trips and N×row re-renders.
  // Surgical patch is one row + counts decrement, refs stay stable for
  // unaffected rows so memo'd list items skip re-render.
  useEffect(() => {
    const unsubscribe = subscribeSettled((id) => {
      void applySettledPatch(queryClient, id);
    });
    return unsubscribe;
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

// Read the just-settled row's terminal status from SQLite and patch the
// cached infinite-list pages, counts, and pending-or-failed list. One
// SELECT per settle replaces a full multi-page refetch.
async function applySettledPatch(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): Promise<void> {
  const row = await getMeasurementById(id);
  // If the row vanished (e.g. user deleted it during upload), drop it
  // everywhere.
  if (!row) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ["measurements", "list"] })) {
      queryClient.setQueryData<InfiniteData<MeasurementItem[]>>(query.queryKey, (old) =>
        removeRowFromPages(old, id),
      );
    }
    queryClient.setQueryData<{ key: string; data: unknown }[]>(
      ["measurements", "pending-or-failed"],
      (old) => (old ? old.filter((r) => r.key !== id) : old),
    );
    queryClient.setQueryData<MeasurementCounts>(["measurements", "counts"], (old) =>
      old ? recomputeCountsAfterRemove(old) : old,
    );
    return;
  }

  const nextStatus = row.status;

  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["measurements", "list"] })) {
    queryClient.setQueryData<InfiniteData<MeasurementItem[]>>(query.queryKey, (old) =>
      patchRowInPages(old, query.queryKey, id, nextStatus),
    );
  }

  // pending-or-failed: drop the row when it leaves the unsynced set.
  queryClient.setQueryData<{ key: string; data: unknown }[]>(
    ["measurements", "pending-or-failed"],
    (old) => {
      if (!old) return old;
      if (nextStatus === "successful") return old.filter((r) => r.key !== id);
      return old;
    },
  );

  // Counts: shift by one between buckets. The previous status is best
  // inferred from the cache (the row was either pending or failed before
  // settle). When in doubt, leave counts alone — they'll resync on the
  // next refetchOnMount.
  queryClient.setQueryData<MeasurementCounts>(["measurements", "counts"], (old) => {
    if (!old) return old;
    if (nextStatus === "successful") {
      // We don't know whether the row was pending or failed before; the
      // total is pending + failed and we just moved one across to
      // successful. Prefer decrementing pending if positive, else failed.
      if (old.pending > 0) return { ...old, pending: old.pending - 1, successful: old.successful + 1 };
      if (old.failed > 0) return { ...old, failed: old.failed - 1, successful: old.successful + 1 };
      return old;
    }
    if (nextStatus === "failed") {
      if (old.pending > 0) return { ...old, pending: old.pending - 1, failed: old.failed + 1 };
      return old;
    }
    return old;
  });
}

function patchRowInPages(
  old: InfiniteData<MeasurementItem[]> | undefined,
  queryKey: readonly unknown[],
  id: string,
  nextStatus: MeasurementStatus,
): InfiniteData<MeasurementItem[]> | undefined {
  if (!old) return old;
  const filter = (queryKey[2] as MeasurementFilter) ?? "all";
  const allowed = statusesForFilter(filter);
  const shouldRemain = allowed.includes(nextStatus);
  let touched = false;
  const pages = old.pages.map((page) => {
    let pageTouched = false;
    let next: MeasurementItem[] | null = null;
    for (let i = 0; i < page.length; i++) {
      const row = page[i];
      if (row.key !== id) continue;
      if (!shouldRemain) {
        next = page.slice(0, i).concat(page.slice(i + 1));
        pageTouched = true;
      } else if (row.status !== nextStatus) {
        next = page.slice();
        next[i] = { ...row, status: nextStatus };
        pageTouched = true;
      }
      break;
    }
    if (!pageTouched) return page;
    touched = true;
    return next ?? page;
  });
  if (!touched) return old;
  return { ...old, pages };
}

function removeRowFromPages(
  old: InfiniteData<MeasurementItem[]> | undefined,
  id: string,
): InfiniteData<MeasurementItem[]> | undefined {
  if (!old) return old;
  let touched = false;
  const pages = old.pages.map((page) => {
    const idx = page.findIndex((r) => r.key === id);
    if (idx < 0) return page;
    touched = true;
    return page.slice(0, idx).concat(page.slice(idx + 1));
  });
  if (!touched) return old;
  return { ...old, pages };
}

function recomputeCountsAfterRemove(old: MeasurementCounts): MeasurementCounts {
  // We don't know which bucket the removed row belonged to. The next
  // refetchOnMount will resync; for now decrement whichever bucket has
  // headroom so the total doesn't drift positive.
  if (old.pending > 0) return { ...old, pending: old.pending - 1 };
  if (old.failed > 0) return { ...old, failed: old.failed - 1 };
  if (old.successful > 0) return { ...old, successful: old.successful - 1 };
  return old;
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
