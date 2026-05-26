import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import type { MeasurementCounts } from "~/shared/db/measurements-storage";

import { applySettledPatchBatch, queryKeys } from "../measurement-list-cache";
import type { MeasurementFilter, MeasurementItem } from "../measurement-list-cache";
import type { SettledItem } from "../outbox";

// Pure-patcher unit tests. No hooks, no Outbox, no DB — just a fresh
// QueryClient pre-seeded with cache entries and a synthetic batch of
// {id, status} items.

type Status = "pending" | "failed" | "successful";

function item(id: string, status: Status): MeasurementItem {
  return {
    id,
    key: id,
    status,
    experimentName: "E",
    protocolName: "P",
    timestamp: "2026-01-01T10:00:00Z",
    questions: [],
    hasComment: false,
    dayKey: "2026-01-01",
  } as MeasurementItem;
}

function seedList(qc: QueryClient, filter: MeasurementFilter, rows: MeasurementItem[]) {
  qc.setQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list(filter), {
    pages: [rows],
    pageParams: [0],
  });
}

let qc: QueryClient;

beforeEach(() => {
  qc = new QueryClient();
});

describe("applySettledPatchBatch — list pages", () => {
  it("flips a row's status in the 'all' filter list cache", () => {
    seedList(qc, "all", [item("r1", "pending")]);

    applySettledPatchBatch(qc, [{ id: "r1", status: "successful" }]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    expect(data?.pages[0][0].status).toBe("successful");
  });

  it("drops a row from the 'unsynced' list when it moves to successful", () => {
    seedList(qc, "unsynced", [item("r1", "pending"), item("r2", "failed")]);

    applySettledPatchBatch(qc, [{ id: "r1", status: "successful" }]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("unsynced"));
    expect(data?.pages[0].map((r) => r.key)).toEqual(["r2"]);
  });

  it("keeps the row in 'unsynced' when status flips to failed (still in-set)", () => {
    seedList(qc, "unsynced", [item("r1", "pending")]);

    applySettledPatchBatch(qc, [{ id: "r1", status: "failed" }]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("unsynced"));
    expect(data?.pages[0][0]).toMatchObject({ key: "r1", status: "failed" });
  });

  it("returns the same object reference when nothing changed (no spurious re-renders)", () => {
    seedList(qc, "all", [item("r1", "successful")]);
    const before = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));

    // Item not in cache — no patch.
    applySettledPatchBatch(qc, [{ id: "x", status: "successful" }]);

    const after = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    expect(after).toBe(before);
  });

  it("patches multiple list filters in one call", () => {
    seedList(qc, "all", [item("r1", "pending")]);
    seedList(qc, "unsynced", [item("r1", "pending")]);

    applySettledPatchBatch(qc, [{ id: "r1", status: "successful" }]);

    const all = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    const unsynced = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("unsynced"));
    expect(all?.pages[0][0].status).toBe("successful");
    expect(unsynced?.pages[0]).toHaveLength(0);
  });
});

describe("applySettledPatchBatch — counts", () => {
  it("moves a success from pending to successful", () => {
    qc.setQueryData<MeasurementCounts>(queryKeys.counts, { pending: 2, failed: 0, successful: 1 });

    applySettledPatchBatch(qc, [{ id: "r1", status: "successful" }]);

    expect(qc.getQueryData(queryKeys.counts)).toEqual({ pending: 1, failed: 0, successful: 2 });
  });

  it("moves a failure from pending to failed", () => {
    qc.setQueryData<MeasurementCounts>(queryKeys.counts, { pending: 1, failed: 0, successful: 0 });

    applySettledPatchBatch(qc, [{ id: "r1", status: "failed" }]);

    expect(qc.getQueryData(queryKeys.counts)).toEqual({ pending: 0, failed: 1, successful: 0 });
  });

  it("applies the net delta for a mixed multi-id batch", () => {
    qc.setQueryData<MeasurementCounts>(queryKeys.counts, { pending: 3, failed: 1, successful: 0 });

    const items: SettledItem[] = [
      { id: "a", status: "successful" },
      { id: "b", status: "successful" },
      { id: "c", status: "failed" },
    ];
    applySettledPatchBatch(qc, items);

    // 3 pending → 0; 2 successful added; 1 retry from pending now failed.
    expect(qc.getQueryData(queryKeys.counts)).toEqual({ pending: 0, failed: 2, successful: 2 });
  });
});

describe("applySettledPatchBatch — pending-or-failed", () => {
  it("drops succeeded rows from the pending-or-failed cache", () => {
    qc.setQueryData<{ key: string; data: unknown }[]>(queryKeys.pendingOrFailed, [
      { key: "ok", data: {} },
      { key: "still", data: {} },
    ]);

    applySettledPatchBatch(qc, [
      { id: "ok", status: "successful" },
      { id: "still", status: "failed" },
    ]);

    expect(qc.getQueryData(queryKeys.pendingOrFailed)).toEqual([{ key: "still", data: {} }]);
  });

  it("returns the same array reference when nothing changed", () => {
    const seed = [{ key: "x", data: {} }];
    qc.setQueryData<{ key: string; data: unknown }[]>(queryKeys.pendingOrFailed, seed);

    applySettledPatchBatch(qc, [{ id: "x", status: "failed" }]);

    expect(qc.getQueryData(queryKeys.pendingOrFailed)).toBe(seed);
  });
});

describe("applySettledPatchBatch — edge cases", () => {
  it("no-ops on empty items", () => {
    seedList(qc, "all", [item("r1", "pending")]);
    const before = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));

    applySettledPatchBatch(qc, []);

    expect(qc.getQueryData(queryKeys.list("all"))).toBe(before);
  });
});
