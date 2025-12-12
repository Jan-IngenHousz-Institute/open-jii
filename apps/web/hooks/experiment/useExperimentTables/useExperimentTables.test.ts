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
        full_name: "catalog.schema.table1",
        display_name: "Table 1",
        row_count: 100,
        columns: [
          {
            name: "id",
            type_text: "INT",
            type_json: '{"type":"integer"}',
            type_name: "INT",
            type_precision: 0,
            type_scale: 0,
            type_interval_type: null,
            position: 0,
            comment: "Primary key",
            nullable: false,
            partition_index: null,
          },
        ],
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

  it("should include column information in tables", () => {
    const mockTablesWithColumns = [
      {
        name: "measurements",
        full_name: "catalog.schema.measurements",
        display_name: "Measurements",
        row_count: 500,
        columns: [
          {
            name: "timestamp",
            type_text: "TIMESTAMP",
            type_json: '{"type":"timestamp"}',
            type_name: "TIMESTAMP",
            type_precision: 0,
            type_scale: 0,
            type_interval_type: null,
            position: 0,
            comment: "Measurement timestamp",
            nullable: false,
            partition_index: null,
          },
          {
            name: "value",
            type_text: "DOUBLE",
            type_json: '{"type":"double"}',
            type_name: "DOUBLE",
            type_precision: 0,
            type_scale: 0,
            type_interval_type: null,
            position: 1,
            comment: "Measurement value",
            nullable: true,
            partition_index: null,
          },
        ],
      },
    ];

    const mockReturnValue = {
      data: { body: mockTablesWithColumns },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

    expect(result.current.tables).toEqual(mockTablesWithColumns);
    expect(result.current.tables?.[0].columns).toHaveLength(2);
    expect(result.current.tables?.[0].columns[0].name).toBe("timestamp");
    expect(result.current.tables?.[0].columns[1].name).toBe("value");
  });
});
