/**
 * useExperimentTables hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.getExperimentTables.useQuery` →
 * `GET /api/v1/experiments/:id/tables`. MSW intercepts that request.
 */
import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentTables } from "./useExperimentTables";

describe("useExperimentTables", () => {
  it("returns empty tables by default", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    const { result } = renderHook(() => useExperimentTables("exp-1"));

    await waitFor(() => {
      expect(result.current.tables).toBeDefined();
    });
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    renderHook(() => useExperimentTables(mockExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockExperimentId } },
      queryKey: ["experiment", mockExperimentId, "tables"],
      staleTime: 2 * 60 * 1000,
    });
  });

  it("should return tables, isLoading, and error from useQuery", () => {
    const mockTables = [
      {
        identifier: "table1",
        tableType: "static",
        displayName: "Table 1",
        totalRows: 100,
        defaultSortColumn: "id",
        errorColumn: undefined,
      },
    ];

    const mockReturnValue = {
      data: { body: mockTables },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.tables).toEqual(mockTables);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", () => {
    const mockReturnValue = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.tables).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to fetch tables");
    const mockReturnValue = {
      data: undefined,
      isLoading: false,
      error: mockError,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.error).toBe(mockError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tables).toBeUndefined();
  });

  it("should pass through experiment ID correctly", () => {
    const differentExperimentId = "another-experiment-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    renderHook(() => useExperimentTables(differentExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: differentExperimentId } },
      queryKey: ["experiment", differentExperimentId, "tables"],
      staleTime: 2 * 60 * 1000,
    });
  });

  it("should handle empty tables array", () => {
    const mockReturnValue = {
      data: { body: [] },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.tables).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should include table metadata in tables", () => {
    const mockTablesWithMetadata = [
      {
        identifier: "measurements",
        tableType: "static",
        displayName: "Measurements",
        totalRows: 500,
        defaultSortColumn: "timestamp",
        errorColumn: "error_info",
      }),
      createExperimentTable({
        name: "table2",
        displayName: "Table 2",
        totalRows: 100,
        defaultSortColumn: "id",
      }),
    ];

    server.mount(contract.experiments.getExperimentTables, { body: mockTables });

    const { result } = renderHook(() => useExperimentTables("exp-1"));

    await waitFor(() => {
      expect(result.current.tables).toHaveLength(2);
    });

    expect(result.current.tables).toEqual(mockTablesWithMetadata);
    expect(result.current.tables?.[0].identifier).toBe("measurements");
    expect(result.current.tables?.[0].displayName).toBe("Measurements");
    expect(result.current.tables?.[0].totalRows).toBe(500);
    expect(result.current.tables?.[0].defaultSortColumn).toBe("timestamp");
    expect(result.current.tables?.[0].errorColumn).toBe("error_info");
  });
});
