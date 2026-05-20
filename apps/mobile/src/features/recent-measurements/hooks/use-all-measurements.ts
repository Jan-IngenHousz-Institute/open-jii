import type { InfiniteData } from "@tanstack/react-query";
import { notifyManager, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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

import { subscribeSettledBatched } from "../services/outbox-state";

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

export function useAllMeasurements(
  filter: MeasurementFilter = "all",
  enableSettleBridge: boolean = true,
) {
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

  // Bridge from the Outbox to react-query: every microtask of settles
  // collapses to one batched patch — single SQLite fan-out + single
  // setQueryData per query, so a burst of N PUBACKs costs ~1 re-render
  // instead of N. The bridge is gated by `enableSettleBridge`: the Recent
  // Measurements screen drops it when unfocused so background PUBACK
  // traffic doesn't drag the JS thread (OJD-1470 — Recent tab kept the
  // listener live after navigating away, growing wire_ms from ~110 ms to
  // multiple seconds).
  useEffect(() => {
    if (!enableSettleBridge) return;
    const unsubscribe = subscribeSettledBatched((ids) => {
      void applySettledPatchBatch(queryClient, ids);
    });
    return unsubscribe;
  }, [queryClient, enableSettleBridge]);

  return {
    measurements,
    counts,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    invalidate,
  };
}

// Read the terminal status of every just-settled row and apply one
// surgical patch per query cache entry. A burst of N settles fans out N
// parallel SELECTs (cheap on JSI SQLite) then performs one setQueryData
// per query — collapsing N×re-renders into one.
async function applySettledPatchBatch(
  queryClient: ReturnType<typeof useQueryClient>,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  // null = row vanished (deleted mid-upload)
  const updates = new Map<string, MeasurementStatus | null>();
  const rows = await Promise.all(
    ids.map(async (id) => ({ id, row: await getMeasurementById(id) })),
  );
  for (const { id, row } of rows) updates.set(id, row?.status ?? null);

  // notifyManager.batch coalesces every cache mutation below into a
  // single subscriber notification so a burst of N settles costs one
  // re-render instead of N — even on top of our outbox-side batching,
  // this guards consumers that subscribe to several keys at once.
  notifyManager.batch(() => {
    for (const query of queryClient
      .getQueryCache()
      .findAll({ queryKey: ["measurements", "list"] })) {
      queryClient.setQueryData<InfiniteData<MeasurementItem[]>>(query.queryKey, (old) =>
        patchPagesBulk(old, query.queryKey, updates),
      );
    }

    // pending-or-failed: drop rows that left the unsynced set (success or
    // removed).
    queryClient.setQueryData<{ key: string; data: unknown }[]>(
      ["measurements", "pending-or-failed"],
      (old) => {
        if (!old) return old;
        let touched = false;
        const next = old.filter((r) => {
          const status = updates.get(r.key);
          if (status === undefined) return true;
          if (status === null || status === "successful") {
            touched = true;
            return false;
          }
          return true;
        });
        return touched ? next : old;
      },
    );

    // Counts: apply the net delta of all settles in one update. When the
    // previous status is unknowable (the cached row is gone or never was)
    // prefer decrementing pending — it's the common case and the next
    // refetchOnMount will resync anyway.
    queryClient.setQueryData<MeasurementCounts>(["measurements", "counts"], (old) => {
      if (!old) return old;
      let pending = old.pending;
      let failed = old.failed;
      let successful = old.successful;
      for (const status of Array.from(updates.values())) {
        if (status === null) {
          if (pending > 0) pending--;
          else if (failed > 0) failed--;
          else if (successful > 0) successful--;
        } else if (status === "successful") {
          if (pending > 0) {
            pending--;
            successful++;
          } else if (failed > 0) {
            failed--;
            successful++;
          }
        } else if (status === "failed") {
          if (pending > 0) {
            pending--;
            failed++;
          }
        }
      }
      if (pending === old.pending && failed === old.failed && successful === old.successful) {
        return old;
      }
      return { pending, failed, successful };
    });
  });
}

function patchPagesBulk(
  old: InfiniteData<MeasurementItem[]> | undefined,
  queryKey: readonly unknown[],
  updates: Map<string, MeasurementStatus | null>,
): InfiniteData<MeasurementItem[]> | undefined {
  if (!old) return old;
  const filter = (queryKey[2] as MeasurementFilter) ?? "all";
  const allowed = statusesForFilter(filter);
  let touched = false;
  const pages = old.pages.map((page) => {
    let next: MeasurementItem[] | null = null;
    for (let i = 0; i < page.length; i++) {
      const row = page[i];
      const status = updates.get(row.key);
      if (status === undefined) continue;
      if (status === null || !allowed.includes(status)) {
        next = next ?? page.slice();
        const idx = next.findIndex((r) => r.key === row.key);
        if (idx >= 0) next.splice(idx, 1);
      } else if (row.status !== status) {
        next = next ?? page.slice();
        const idx = next.findIndex((r) => r.key === row.key);
        if (idx >= 0) next[idx] = { ...next[idx], status };
      }
    }
    if (next === null) return page;
    touched = true;
    return next;
  });
  if (!touched) return old;
  return { ...old, pages };
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
