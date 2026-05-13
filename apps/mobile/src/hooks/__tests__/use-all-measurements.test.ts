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
      .mockResolvedValue({ pending: 0, uploading: 0, failed: 0, successful: 0 }),
    mockParseQuestions: vi.fn().mockReturnValue([]),
  }),
);

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: mockGetMeasurements,
  countMeasurementsByStatus: mockCountMeasurementsByStatus,
}));

vi.mock("~/utils/convert-cycle-answers-to-array", () => ({
  parseQuestions: mockParseQuestions,
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

type StorageStatus = "pending" | "failed" | "uploading" | "successful";

interface StoredMeasurement {
  id: string;
  status: StorageStatus;
  data: {
    topic: string;
    measurementResult: object;
    metadata: { timestamp: string; experimentName: string; protocolName: string };
  };
}

function row(
  id: string,
  status: StorageStatus,
  timestamp: string,
  experimentName: string,
  measurementResult: object = { value: 1 },
): StoredMeasurement {
  return {
    id,
    status,
    data: {
      topic: "test/topic",
      measurementResult,
      metadata: { timestamp, experimentName, protocolName: "proto-1" },
    },
  };
}

// SQL-side filter: returns only the rows the storage call asked for.
function rowsFor(rows: StoredMeasurement[], requested: StorageStatus | StorageStatus[]) {
  const wanted = new Set(Array.isArray(requested) ? requested : [requested]);
  return rows.filter((r) => wanted.has(r.status));
}

describe("useAllMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockCountMeasurementsByStatus.mockResolvedValue({
      pending: 0,
      uploading: 0,
      failed: 0,
      successful: 0,
    });
    mockParseQuestions.mockReturnValue([]);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ---------------------------------------------------------------------------
  // data fetching
  // ---------------------------------------------------------------------------

  describe("data fetching", () => {
    it("fetches all four statuses in a single SQL call when filter is 'all'", async () => {
      renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() =>
        expect(mockGetMeasurements).toHaveBeenCalledWith([
          "pending",
          "failed",
          "uploading",
          "successful",
        ]),
      );
      expect(mockGetMeasurements).toHaveBeenCalledTimes(1);
    });

    it("queries only 'successful' when filter is 'synced'", async () => {
      renderHook(() => useAllMeasurements("synced"), { wrapper });
      await waitFor(() => expect(mockGetMeasurements).toHaveBeenCalledWith(["successful"]));
    });

    it("queries pending + failed + uploading when filter is 'unsynced'", async () => {
      renderHook(() => useAllMeasurements("unsynced"), { wrapper });
      await waitFor(() =>
        expect(mockGetMeasurements).toHaveBeenCalledWith(["pending", "failed", "uploading"]),
      );
    });

    it("hands the raw storage status through to MeasurementItem (no lossy mapping)", async () => {
      mockGetMeasurements.mockResolvedValueOnce([
        row("p1", "pending", "2026-01-01T11:00:00Z", "P"),
        row("f1", "failed", "2026-01-01T10:00:00Z", "F"),
        row("u1", "uploading", "2026-01-01T09:00:00Z", "U"),
        row("s1", "successful", "2026-01-01T12:00:00Z", "S"),
      ]);

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(4));
      const byKey = new Map(result.current.measurements.map((m) => [m.key, m.status]));
      expect(byKey.get("p1")).toBe("pending");
      expect(byKey.get("f1")).toBe("failed");
      expect(byKey.get("u1")).toBe("uploading");
      expect(byKey.get("s1")).toBe("successful");
    });

    it("sorts results newest-first by timestamp", async () => {
      mockGetMeasurements.mockResolvedValueOnce([
        row("old", "failed", "2026-01-01T08:00:00Z", "Old"),
        row("new", "successful", "2026-01-01T12:00:00Z", "New"),
      ]);

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements[0].key).toBe("new");
      expect(result.current.measurements[1].key).toBe("old");
    });

    it("calls parseQuestions for each measurement result", async () => {
      const measurementResult = { value: 99 };
      mockGetMeasurements.mockResolvedValueOnce([
        row("k1", "failed", "2026-01-01T10:00:00Z", "E", measurementResult),
      ]);

      renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(mockParseQuestions).toHaveBeenCalled());
      expect(mockParseQuestions).toHaveBeenCalledWith(measurementResult);
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
      const fixture: StoredMeasurement[] = [
        row("p1", "pending", "2026-01-01T11:00:00Z", "Pending"),
        row("f1", "failed", "2026-01-01T10:00:00Z", "Failed"),
        row("u1", "uploading", "2026-01-01T09:00:00Z", "Uploading"),
        row("s1", "successful", "2026-01-01T12:00:00Z", "Synced 1"),
        row("s2", "successful", "2026-01-01T08:00:00Z", "Synced 2"),
      ];
      mockGetMeasurements.mockImplementation((status) => Promise.resolve(rowsFor(fixture, status)));
    });

    it("returns every row when filter is 'all'", async () => {
      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(5));
    });

    it("returns only successful rows when filter is 'synced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements.every((m) => m.status === "successful")).toBe(true);
    });

    it("returns pending/failed/uploading when filter is 'unsynced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("unsynced"), { wrapper });
      await waitFor(() => expect(result.current.measurements).toHaveLength(3));
      const statuses = new Set(result.current.measurements.map((m) => m.status));
      expect(statuses).toEqual(new Set(["pending", "failed", "uploading"]));
    });

    it("re-queries SQL when the filter prop changes (no JS-side filtering)", async () => {
      const { rerender } = renderHook(
        ({ filter }: { filter: "all" | "synced" | "unsynced" }) => useAllMeasurements(filter),
        { wrapper, initialProps: { filter: "all" as const } },
      );

      await waitFor(() =>
        expect(mockGetMeasurements).toHaveBeenCalledWith([
          "pending",
          "failed",
          "uploading",
          "successful",
        ]),
      );

      rerender({ filter: "synced" });
      await waitFor(() => expect(mockGetMeasurements).toHaveBeenCalledWith(["successful"]));
    });
  });

  // ---------------------------------------------------------------------------
  // counts (SQL COUNT … GROUP BY)
  // ---------------------------------------------------------------------------

  describe("counts", () => {
    it("exposes raw SQL counts unchanged by the active filter", async () => {
      mockCountMeasurementsByStatus.mockResolvedValueOnce({
        pending: 3,
        uploading: 1,
        failed: 2,
        successful: 7,
      });

      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });

      await waitFor(() => expect(result.current.counts.successful).toBe(7));
      expect(result.current.counts).toEqual({ pending: 3, uploading: 1, failed: 2, successful: 7 });
    });

    it("uploadingCount mirrors counts.uploading", async () => {
      mockCountMeasurementsByStatus.mockResolvedValueOnce({
        pending: 0,
        uploading: 4,
        failed: 0,
        successful: 0,
      });

      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(result.current.uploadingCount).toBe(4));
    });

    it("invokes countMeasurementsByStatus exactly once per render cycle", async () => {
      renderHook(() => useAllMeasurements("all"), { wrapper });
      await waitFor(() => expect(mockCountMeasurementsByStatus).toHaveBeenCalled());
      expect(mockCountMeasurementsByStatus).toHaveBeenCalledTimes(1);
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
});
