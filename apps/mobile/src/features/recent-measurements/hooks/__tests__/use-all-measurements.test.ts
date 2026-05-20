// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useAllMeasurements } from "../use-all-measurements";

const { mockGetMeasurements, mockCountMeasurementsByStatus, mockParseQuestions } = vi.hoisted(
  () => ({
    mockGetMeasurements: vi.fn().mockResolvedValue([]),
    mockCountMeasurementsByStatus: vi
      .fn()
      .mockResolvedValue({ pending: 0, failed: 0, successful: 0 }),
    mockParseQuestions: vi.fn().mockReturnValue([]),
  }),
);

vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurementsList: mockGetMeasurementsList,
  countMeasurementsByStatus: mockCountMeasurementsByStatus,
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

type StorageStatus = "pending" | "failed" | "successful";

interface ListRow {
  id: string;
  status: StorageStatus;
  experimentName: string;
  protocolName: string;
  timestamp: string;
  questions: { question_label: string; question_text: string; question_answer: string }[];
  hasComment: boolean;
}

function row(
  id: string,
  status: StorageStatus,
  timestamp: string,
  experimentName: string,
  overrides: Partial<ListRow> = {},
): ListRow {
  return {
    id,
    status,
    experimentName,
    protocolName: "proto-1",
    timestamp,
    questions: [],
    hasComment: false,
    ...overrides,
  };
}

// SQL-side filter: returns only the rows the storage call asked for.
function rowsFor(rows: ListRow[], requested: StorageStatus[]) {
  const wanted = new Set(requested);
  return rows.filter((r) => wanted.has(r.status));
}

describe("useAllMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurementsList.mockResolvedValue([]);
    mockCountMeasurementsByStatus.mockResolvedValue({
      pending: 0,
      uploading: 0,
      failed: 0,
      successful: 0,
    });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ---------------------------------------------------------------------------
  // SQL-side filter — useAllMeasurements asks the storage layer for the exact
  // status set the active filter implies. No JS-side filtering.
  // ---------------------------------------------------------------------------

  describe("data fetching", () => {
    it("fetches all four statuses when filter is 'all'", async () => {
      renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() =>
        expect(mockGetMeasurementsList).toHaveBeenCalledWith(
          ["pending", "failed", "successful"],
          { limit: 50, offset: 0 },
        ),
      );
    });

    it("queries only 'successful' when filter is 'synced'", async () => {
      renderHook(() => useAllMeasurements("synced"), { wrapper });
      await waitFor(() =>
        expect(mockGetMeasurementsList).toHaveBeenCalledWith(["successful"], expect.any(Object)),
      );
    });

    it("queries pending + failed when filter is 'unsynced'", async () => {
      renderHook(() => useAllMeasurements("unsynced"), { wrapper });
      await waitFor(() =>
        expect(mockGetMeasurementsList).toHaveBeenCalledWith(
          ["pending", "failed"],
          expect.any(Object),
        ),
      );
    });

    it("hands the raw storage status through to MeasurementItem (no lossy mapping)", async () => {
      mockGetMeasurementsList.mockResolvedValueOnce([
        row("p1", "pending", "2026-01-01T11:00:00Z", "P"),
        row("f1", "failed", "2026-01-01T10:00:00Z", "F"),
        row("s1", "successful", "2026-01-01T12:00:00Z", "S"),
      ]);

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(3));
      const byKey = new Map(result.current.measurements.map((m) => [m.key, m.status]));
      expect(byKey.get("p1")).toBe("pending");
      expect(byKey.get("f1")).toBe("failed");
      expect(byKey.get("s1")).toBe("successful");
    });

    it("preserves the SQL row order (already sorted DESC by timestamp)", async () => {
      // The hook does NOT re-sort; SQL ORDER BY does it. Provide rows already
      // sorted newest-first and verify they come out the same way.
      mockGetMeasurementsList.mockResolvedValueOnce([
        row("new", "successful", "2026-01-01T12:00:00Z", "New"),
        row("old", "failed", "2026-01-01T08:00:00Z", "Old"),
      ]);

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements[0].key).toBe("new");
      expect(result.current.measurements[1].key).toBe("old");
    });

    it("passes through hasComment and questions from the lean SELECT (no Zod)", async () => {
      const questions = [{ question_label: "q", question_text: "Q?", question_answer: "A" }];
      mockGetMeasurementsList.mockResolvedValueOnce([
        row("k1", "failed", "2026-01-01T10:00:00Z", "E", { questions, hasComment: true }),
      ]);

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.measurements[0].questions).toEqual(questions);
      expect(result.current.measurements[0].hasComment).toBe(true);
    });

    it("returns an empty array when no measurements match the filter", async () => {
      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toEqual([]));
    });
  });

  // ---------------------------------------------------------------------------
  // filter applied at SQL level
  // ---------------------------------------------------------------------------

  describe("filter at SQL level", () => {
    beforeEach(() => {
      const fixture: ListRow[] = [
        row("p1", "pending", "2026-01-01T11:00:00Z", "Pending"),
        row("f1", "failed", "2026-01-01T10:00:00Z", "Failed"),
        row("s1", "successful", "2026-01-01T12:00:00Z", "Synced 1"),
        row("s2", "successful", "2026-01-01T08:00:00Z", "Synced 2"),
      ];
      mockGetMeasurementsList.mockImplementation((statuses: StorageStatus[]) =>
        Promise.resolve(rowsFor(fixture, statuses)),
      );
    });

    it("returns every row when filter is 'all'", async () => {
      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(4));
    });

    it("returns only successful rows when filter is 'synced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements.every((m) => m.status === "successful")).toBe(true);
    });

    it("returns pending/failed when filter is 'unsynced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("unsynced"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      const statuses = new Set(result.current.measurements.map((m) => m.status));
      expect(statuses).toEqual(new Set(["pending", "failed"]));
    });

    it("re-queries SQL when the filter prop changes (no JS-side filtering)", async () => {
      const { rerender } = renderHook(
        ({ filter }: { filter: "all" | "synced" | "unsynced" }) => useAllMeasurements(filter),
        { wrapper, initialProps: { filter: "all" } },
      );

      await waitFor(() =>
        expect(mockGetMeasurementsList).toHaveBeenCalledWith(
          ["pending", "failed", "successful"],
          expect.any(Object),
        ),
      );

      rerender({ filter: "synced" });
      await waitFor(() =>
        expect(mockGetMeasurementsList).toHaveBeenCalledWith(["successful"], expect.any(Object)),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // counts (SQL COUNT … GROUP BY)
  // ---------------------------------------------------------------------------

  describe("counts", () => {
    it("exposes raw SQL counts unchanged by the active filter", async () => {
      mockCountMeasurementsByStatus.mockResolvedValueOnce({
        pending: 3,
        failed: 2,
        successful: 7,
      });

      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });

      await waitFor(() => expect(result.current.counts.successful).toBe(7));
      expect(result.current.counts).toEqual({ pending: 3, failed: 2, successful: 7 });
    });

    it("invokes countMeasurementsByStatus exactly once per render cycle", async () => {
      renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(mockCountMeasurementsByStatus).toHaveBeenCalled());
      expect(mockCountMeasurementsByStatus).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // pagination (useInfiniteQuery)
  // ---------------------------------------------------------------------------

  describe("pagination", () => {
    it("reports hasNextPage=true when the first page is full", async () => {
      mockGetMeasurementsList.mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, i) =>
          row(`k${i}`, "successful", `2026-01-01T10:00:${String(i).padStart(2, "0")}Z`, "E"),
        ),
      );

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(50));
      expect(result.current.hasNextPage).toBe(true);
    });

    it("reports hasNextPage=false when a partial page comes back", async () => {
      mockGetMeasurementsList.mockResolvedValueOnce(
        Array.from({ length: 17 }, (_, i) =>
          row(`k${i}`, "successful", `2026-01-01T10:00:${String(i).padStart(2, "0")}Z`, "E"),
        ),
      );

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(17));
      expect(result.current.hasNextPage).toBe(false);
    });

    it("fetchNextPage requests offset=50 after a full first page", async () => {
      mockGetMeasurementsList
        .mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) =>
            row(`a${i}`, "successful", `2026-01-01T10:00:${String(i).padStart(2, "0")}Z`, "E"),
          ),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) =>
            row(`b${i}`, "successful", `2026-01-01T09:00:${String(i).padStart(2, "0")}Z`, "E"),
          ),
        );

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(50));

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => expect(result.current.measurements).toHaveLength(60));
      expect(mockGetMeasurementsList).toHaveBeenLastCalledWith(
        ["pending", "failed", "uploading", "successful"],
        { limit: 50, offset: 50 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // invalidate
  // ---------------------------------------------------------------------------

  describe("invalidate", () => {
    it("invalidates everything under the measurements query key", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toBeDefined());

      act(() => {
        result.current.invalidate();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // settle invalidation — per-item bridge from upload queue to react-query
  // ---------------------------------------------------------------------------

  describe("settle invalidation", () => {
    // Only fake setTimeout/clearTimeout — leave Date.now real (so the
    // leading-edge check `now - lastInvalidatedAt >= 250` fires on the
    // first settle) and microtasks unfaked (react-query needs them).
    function useThrottleTimers() {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    }

    it("invalidates the measurements key on the first settle (leading edge)", async () => {
      const state = await import("../../services/upload-queue-state");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result, unmount } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toBeDefined());
      invalidateSpy.mockClear();

      act(() => {
        state.markEnqueued("row-1");
        state.markSettled("row-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("coalesces a burst of settles inside the throttle window into a single trailing refetch", async () => {
      const state = await import("../../services/upload-queue-state");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result, unmount } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toBeDefined());
      invalidateSpy.mockClear();

      // Leading edge — counts as the first invalidate.
      act(() => {
        state.markEnqueued("a");
        state.markSettled("a");
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      useThrottleTimers();

      // Burst of three more settles inside the 250ms window — should add
      // exactly one trailing invalidate, not three.
      act(() => {
        state.markEnqueued("b");
        state.markSettled("b");
        state.markEnqueued("c");
        state.markSettled("c");
        state.markEnqueued("d");
        state.markSettled("d");
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
      unmount();
    });

    it("unsubscribes on unmount — settles after unmount do not invalidate", async () => {
      const state = await import("../../services/upload-queue-state");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result, unmount } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toBeDefined());

      unmount();
      invalidateSpy.mockClear();

      act(() => {
        state.markEnqueued("orphan");
        state.markSettled("orphan");
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
