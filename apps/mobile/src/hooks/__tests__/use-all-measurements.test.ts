// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const { mockGetMeasurements, mockParseQuestions } = vi.hoisted(() => ({
  mockGetMeasurements: vi.fn().mockResolvedValue([]),
  mockParseQuestions: vi.fn().mockReturnValue([]),
}));

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: mockGetMeasurements,
}));

vi.mock("~/utils/convert-cycle-answers-to-array", () => ({
  parseQuestions: mockParseQuestions,
}));

import { useAllMeasurements } from "../use-all-measurements";

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function entry(key: string, timestamp: string, experimentName: string) {
  return [
    key,
    {
      topic: "test/topic",
      measurementResult: { value: 1 },
      metadata: { timestamp, experimentName, protocolName: "proto-1" },
    },
  ];
}

describe("useAllMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockParseQuestions.mockReturnValue([]);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ---------------------------------------------------------------------------
  // fetching & mapping
  // ---------------------------------------------------------------------------

  describe("data fetching", () => {
    it("fetches from failed, uploading, and successful buckets", async () => {
      renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(mockGetMeasurements).toHaveBeenCalledWith("failed"));
      expect(mockGetMeasurements).toHaveBeenCalledWith("uploading");
      expect(mockGetMeasurements).toHaveBeenCalledWith("successful");
    });

    it("maps failed entries to unsynced items", async () => {
      mockGetMeasurements.mockImplementation((status: string) =>
        Promise.resolve(status === "failed" ? [entry("k1", "2026-01-01T10:00:00Z", "Exp A")] : []),
      );

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.measurements[0]).toMatchObject({
        key: "k1",
        status: "unsynced",
        experimentName: "Exp A",
      });
    });

    it("maps successful entries to synced items", async () => {
      mockGetMeasurements.mockImplementation((status: string) =>
        Promise.resolve(
          status === "successful" ? [entry("k2", "2026-01-01T09:00:00Z", "Exp B")] : [],
        ),
      );

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.measurements[0]).toMatchObject({
        key: "k2",
        status: "synced",
        experimentName: "Exp B",
      });
    });

    it("sorts combined results newest-first by timestamp", async () => {
      mockGetMeasurements.mockImplementation((status: string) => {
        if (status === "failed")
          return Promise.resolve([entry("old", "2026-01-01T08:00:00Z", "Old")]);
        if (status === "successful")
          return Promise.resolve([entry("new", "2026-01-01T12:00:00Z", "New")]);
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements[0].key).toBe("new");
      expect(result.current.measurements[1].key).toBe("old");
    });

    it("calls parseQuestions for each measurement result", async () => {
      const measurementResult = { value: 99 };
      mockGetMeasurements.mockImplementation((status: string) =>
        status === "failed"
          ? Promise.resolve([
              [
                "k1",
                {
                  topic: "t",
                  measurementResult,
                  metadata: {
                    timestamp: "2026-01-01T10:00:00Z",
                    experimentName: "E",
                    protocolName: "P",
                  },
                },
              ],
            ])
          : Promise.resolve([]),
      );

      renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(mockParseQuestions).toHaveBeenCalled());
      expect(mockParseQuestions).toHaveBeenCalledWith(measurementResult);
    });

    it("maps uploading entries to syncing items", async () => {
      mockGetMeasurements.mockImplementation((status: string) =>
        Promise.resolve(
          status === "uploading" ? [entry("k3", "2026-01-01T11:00:00Z", "Exp C")] : [],
        ),
      );

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.measurements[0]).toMatchObject({
        key: "k3",
        status: "syncing",
        experimentName: "Exp C",
      });
    });

    it("returns empty array when no measurements exist", async () => {
      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.allMeasurements).toEqual([]));
    });
  });

  // ---------------------------------------------------------------------------
  // filter
  // ---------------------------------------------------------------------------

  describe("filter", () => {
    beforeEach(() => {
      mockGetMeasurements.mockImplementation((status: string) => {
        if (status === "failed")
          return Promise.resolve([entry("u1", "2026-01-01T10:00:00Z", "Unsynced")]);
        if (status === "successful")
          return Promise.resolve([
            entry("s1", "2026-01-01T12:00:00Z", "Synced 1"),
            entry("s2", "2026-01-01T08:00:00Z", "Synced 2"),
          ]);
        return Promise.resolve([]);
      });
    });

    it("returns all measurements for filter 'all'", async () => {
      const { result } = renderHook(() => useAllMeasurements("all"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(3));
    });

    it("defaults to 'all' when no filter provided", async () => {
      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(3));
    });

    it("returns only synced items for filter 'synced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      expect(result.current.measurements.every((m) => m.status === "synced")).toBe(true);
    });

    it("returns only unsynced items for filter 'unsynced'", async () => {
      const { result } = renderHook(() => useAllMeasurements("unsynced"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.measurements[0].status).toBe("unsynced");
    });

    it("includes syncing items in the 'unsynced' filter", async () => {
      mockGetMeasurements.mockImplementation((status: string) => {
        if (status === "failed")
          return Promise.resolve([entry("u1", "2026-01-01T10:00:00Z", "Unsynced")]);
        if (status === "uploading")
          return Promise.resolve([entry("up1", "2026-01-01T09:00:00Z", "Uploading")]);
        return Promise.resolve([entry("s1", "2026-01-01T12:00:00Z", "Synced")]);
      });

      const { result } = renderHook(() => useAllMeasurements("unsynced"), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(2));
      const statuses = result.current.measurements.map((m) => m.status);
      expect(statuses).toContain("unsynced");
      expect(statuses).toContain("syncing");
    });

    it("updates measurements reactively when filter changes", async () => {
      const { result, rerender } = renderHook(
        ({ filter }: { filter: "all" | "synced" | "unsynced" }) => useAllMeasurements(filter),
        { wrapper, initialProps: { filter: "all" as const } },
      );

      await waitFor(() => expect(result.current.measurements).toHaveLength(3));

      rerender({ filter: "synced" });
      expect(result.current.measurements).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // allMeasurements vs measurements
  // ---------------------------------------------------------------------------

  describe("allMeasurements", () => {
    it("is unfiltered while measurements respects the active filter", async () => {
      mockGetMeasurements.mockImplementation((status: string) => {
        if (status === "failed")
          return Promise.resolve([entry("u1", "2026-01-01T10:00:00Z", "U")]);
        if (status === "successful")
          return Promise.resolve([entry("s1", "2026-01-01T12:00:00Z", "S")]);
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useAllMeasurements("synced"), { wrapper });

      await waitFor(() => expect(result.current.allMeasurements).toHaveLength(2));
      expect(result.current.measurements).toHaveLength(1);
      expect(result.current.measurements[0].status).toBe("synced");
    });
  });

  // ---------------------------------------------------------------------------
  // uploadingCount
  // ---------------------------------------------------------------------------

  describe("uploadingCount", () => {
    it("counts items with syncing status", async () => {
      mockGetMeasurements.mockImplementation((status: string) => {
        if (status === "uploading")
          return Promise.resolve([
            entry("up1", "2026-01-01T10:00:00Z", "Up1"),
            entry("up2", "2026-01-01T09:00:00Z", "Up2"),
          ]);
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.uploadingCount).toBe(2));
    });

    it("returns zero when no items are uploading", async () => {
      mockGetMeasurements.mockImplementation((status: string) =>
        status === "failed"
          ? Promise.resolve([entry("u1", "2026-01-01T10:00:00Z", "U")])
          : Promise.resolve([]),
      );

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });

      await waitFor(() => expect(result.current.measurements).toHaveLength(1));
      expect(result.current.uploadingCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // invalidate
  // ---------------------------------------------------------------------------

  describe("invalidate", () => {
    it("invalidates the measurements query", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAllMeasurements(), { wrapper });
      await waitFor(() => expect(result.current.measurements).toBeDefined());

      act(() => {
        result.current.invalidate();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });
});
