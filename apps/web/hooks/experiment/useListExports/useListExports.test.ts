import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useListExports } from "./useListExports";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      listExports: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useListExports", () => {
  const mockExperimentId = "test-experiment-id";
  const mockTableName = "raw_data";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: mockExperimentId },
        query: { tableName: mockTableName },
      },
      queryKey: ["exports", mockExperimentId, mockTableName],
      refetchInterval: 60_000,
    });
  });

  it("should return exports data from useQuery", () => {
    const mockExports = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv" as const,
        status: "completed" as const,
        filePath: "/path/to/file.csv",
        rowCount: 100,
        fileSize: 1024,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
      },
    ];

    const mockReturnValue = {
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { result } = renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(result.current.data?.body.exports).toEqual(mockExports);
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
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { result } = renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to fetch exports");
    const mockReturnValue = {
      data: undefined,
      isLoading: false,
      error: mockError,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { result } = renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(result.current.error).toBe(mockError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("should handle empty exports array", () => {
    const mockReturnValue = {
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { result } = renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(result.current.data?.body.exports).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle active exports without exportId", () => {
    const mockExports = [
      {
        exportId: null,
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "ndjson" as const,
        status: "running" as const,
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
    ];

    const mockReturnValue = {
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { result } = renderHook(() =>
      useListExports({
        experimentId: mockExperimentId,
        tableName: mockTableName,
      }),
    );

    expect(result.current.data?.body.exports).toEqual(mockExports);
    expect(result.current.data?.body.exports[0]?.exportId).toBeNull();
    expect(result.current.data?.body.exports[0]?.status).toBe("running");
  });

  it("should update queryKey when parameters change", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.listExports.useQuery = mockUseQuery;

    const { rerender } = renderHook(
      ({ experimentId, tableName }) =>
        useListExports({
          experimentId,
          tableName,
        }),
      {
        initialProps: {
          experimentId: mockExperimentId,
          tableName: mockTableName,
        },
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: mockExperimentId },
        query: { tableName: mockTableName },
      },
      queryKey: ["exports", mockExperimentId, mockTableName],
      refetchInterval: 60_000,
    });

    // Change table name
    const newTableName = "device";
    rerender({
      experimentId: mockExperimentId,
      tableName: newTableName,
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: mockExperimentId },
        query: { tableName: newTableName },
      },
      queryKey: ["exports", mockExperimentId, newTableName],
      refetchInterval: 60_000,
    });
  });
});
