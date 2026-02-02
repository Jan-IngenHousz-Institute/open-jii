import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentTables } from "./useExperimentTables";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentTables: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentTables", () => {
  const mockExperimentId = "test-experiment-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
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
        name: "table1",
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
        name: "measurements",
        displayName: "Measurements",
        totalRows: 500,
        defaultSortColumn: "timestamp",
        errorColumn: "error_info",
      },
    ];

    const mockReturnValue = {
      data: { body: mockTablesWithMetadata },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.tables).toEqual(mockTablesWithMetadata);
    expect(result.current.tables?.[0].name).toBe("measurements");
    expect(result.current.tables?.[0].displayName).toBe("Measurements");
    expect(result.current.tables?.[0].totalRows).toBe(500);
    expect(result.current.tables?.[0].defaultSortColumn).toBe("timestamp");
    expect(result.current.tables?.[0].errorColumn).toBe("error_info");
  });
});
