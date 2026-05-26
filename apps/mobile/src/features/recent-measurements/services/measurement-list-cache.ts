import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { notifyManager } from "@tanstack/react-query";
import type {
  MeasurementCounts,
  MeasurementListRow,
  MeasurementStatus,
} from "~/shared/db/measurements-storage";

import type { SettledItem } from "./outbox";

// Single source for the Recent Measurements react-query cache: the keys
// that exist, and the surgical patcher that applies a burst of Outbox
// settles to them. Pure: queryClient + items in, mutations out. No DB
// reads — the SettledItem already carries the terminal status.

export type MeasurementFilter = "all" | "synced" | "unsynced";

// List rows surfaced to the UI. Carries `key` (= id) for FlashList +
// React reconciliation; shape matches what `useAllMeasurements` returns.
export type MeasurementItem = MeasurementListRow & { key: string };

export const queryKeys = {
  root: ["measurements"] as const,
  list: (filter: MeasurementFilter) => ["measurements", "list", filter] as const,
  listAll: ["measurements", "list"] as const,
  counts: ["measurements", "counts"] as const,
  pendingOrFailed: ["measurements", "pending-or-failed"] as const,
  top: (n: number) => ["measurements", "top", n] as const,
  topAll: ["measurements", "top"] as const,
} as const;

export function statusesForFilter(filter: MeasurementFilter): MeasurementStatus[] {
  if (filter === "synced") return ["successful"];
  if (filter === "unsynced") return ["pending", "failed"];
  return ["pending", "failed", "successful"];
}

// Apply a burst of Outbox settles to every measurement-list cache entry
// in one shot. notifyManager.batch collapses all setQueryData mutations
// below into a single subscriber notification so N settles cost ~1
// re-render.
export function applySettledPatchBatch(
  queryClient: QueryClient,
  items: readonly SettledItem[],
): void {
  if (items.length === 0) return;
  const updates = new Map<string, MeasurementStatus>();
  for (const item of items) updates.set(item.id, item.status);

  notifyManager.batch(() => {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.listAll })) {
      queryClient.setQueryData<InfiniteData<MeasurementItem[]>>(query.queryKey, (old) =>
        patchPagesBulk(old, query.queryKey, updates),
      );
    }

    // Home preview ("top N") — a flat, all-statuses, capped list (not an
    // infinite query). A settle only flips a row's status in place;
    // recency-based membership/order don't change here, so no row is added
    // or removed. Without this patch the home card keeps showing "queued"
    // until a refetch (navigating to Recent / reloading the app). See OJD-1470.
    for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.topAll })) {
      queryClient.setQueryData<MeasurementItem[]>(query.queryKey, (old) =>
        patchFlatBulk(old, updates),
      );
    }

    // pending-or-failed: drop rows that left the unsynced set.
    queryClient.setQueryData<{ key: string; data: unknown }[]>(queryKeys.pendingOrFailed, (old) => {
      if (!old) return old;
      let touched = false;
      const next = old.filter((r) => {
        const status = updates.get(r.key);
        if (status === undefined) return true;
        if (status === "successful") {
          touched = true;
          return false;
        }
        return true;
      });
      return touched ? next : old;
    });

    // Counts: apply the net delta of all settles in one update. When the
    // previous status isn't recorded in cache (cold start), the next
    // refetchOnMount will resync exact counts.
    queryClient.setQueryData<MeasurementCounts>(queryKeys.counts, (old) => {
      if (!old) return old;
      let pending = old.pending;
      let failed = old.failed;
      let successful = old.successful;
      for (const status of Array.from(updates.values())) {
        if (status === "successful") {
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

// Flat-list variant for the home "top N" cache: update each row's status in
// place. The top list uses the "all" filter (every status is allowed), so a
// settle never removes a row — only flips its status. Returns the same array
// reference when nothing changed so subscribers don't re-render needlessly.
function patchFlatBulk(
  old: MeasurementItem[] | undefined,
  updates: Map<string, MeasurementStatus>,
): MeasurementItem[] | undefined {
  if (!old) return old;
  let next: MeasurementItem[] | null = null;
  for (let i = 0; i < old.length; i++) {
    const row = old[i];
    const status = updates.get(row.key);
    if (status === undefined || row.status === status) continue;
    next = next ?? old.slice();
    next[i] = { ...next[i], status };
  }
  return next ?? old;
}

function patchPagesBulk(
  old: InfiniteData<MeasurementItem[]> | undefined,
  queryKey: readonly unknown[],
  updates: Map<string, MeasurementStatus>,
): InfiniteData<MeasurementItem[]> | undefined {
  if (!old) return old;
  const filter = (queryKey[2] as MeasurementFilter) ?? "all";
  const allowed = statusesForFilter(filter);
  let touched = false;
  const pages = old.pages.map((page) => {
    let next: MeasurementItem[] | null = null;
    for (const row of page) {
      const status = updates.get(row.key);
      if (status === undefined) continue;
      if (!allowed.includes(status)) {
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
