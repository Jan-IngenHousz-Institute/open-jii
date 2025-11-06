/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { tsr } from "~/lib/tsr";

import {
  useExperimentVisualizationData,
  useExperimentTables,
} from "./useExperimentVisualizationData";

vi.mock("~/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentData: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useExperimentVisualizationData", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
          columns: ["timestamp", "value"],
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-123" },
        query: {
          tableName: "measurements",
          columns: "timestamp,value",
        },
      },
      queryKey: [
        "experiment-visualization-data",
        "exp-123",
        "measurements",
        ["timestamp", "value"],
      ],
      staleTime: 120000,
      enabled: true,
    });
  });

  it("should handle columns parameter being undefined", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-123" },
        query: {
          tableName: "measurements",
          columns: undefined,
        },
      },
      queryKey: ["experiment-visualization-data", "exp-123", "measurements", undefined],
      staleTime: 120000,
      enabled: true,
    });
  });

  it("should disable query when enabled is false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    renderHook(
      () =>
        useExperimentVisualizationData(
          "exp-123",
          {
            tableName: "measurements",
          },
          false,
        ),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("should disable query when tableName is empty", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("should return successful data and table info", () => {
    const mockData = {
      status: 200,
      body: [
        {
          name: "measurements",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 1000,
          data: {
            columns: [
              { name: "timestamp", type: "TIMESTAMP" },
              { name: "value", type: "DOUBLE" },
            ],
            rows: [
              { timestamp: "2024-01-01", value: 123.45 },
              { timestamp: "2024-01-02", value: 234.56 },
            ],
          },
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.data).toEqual(mockData.body[0].data);
    expect(result.current.tableInfo).toEqual({
      name: "measurements",
      catalog_name: "catalog1",
      schema_name: "schema1",
      totalRows: 1000,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = {
      status: 404,
      message: "Table not found",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it("should return undefined table info when data body is empty", () => {
    const mockData = {
      status: 200,
      body: [],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
  });
});

describe("useExperimentTables", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    renderHook(() => useExperimentTables("exp-123"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-123" },
        query: {
          pageSize: 1,
        },
      },
      queryKey: ["experiment-tables", "exp-123"],
      staleTime: 120000,
    });
  });

  it("should return empty tables array when loading", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables("exp-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.tables).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should extract tables info from response", () => {
    const mockData = {
      status: 200,
      body: [
        {
          name: "measurements",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 1000,
          data: {
            columns: [
              { name: "timestamp", type: "TIMESTAMP" },
              { name: "value", type: "DOUBLE" },
            ],
            rows: [],
          },
        },
        {
          name: "annotations",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 50,
          data: {
            columns: [
              { name: "id", type: "STRING" },
              { name: "note", type: "STRING" },
            ],
            rows: [],
          },
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables("exp-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.tables).toHaveLength(2);
    expect(result.current.tables[0]).toEqual({
      name: "measurements",
      catalog_name: "catalog1",
      schema_name: "schema1",
      totalRows: 1000,
      columns: [
        { name: "timestamp", type: "TIMESTAMP" },
        { name: "value", type: "DOUBLE" },
      ],
    });
    expect(result.current.tables[1]).toEqual({
      name: "annotations",
      catalog_name: "catalog1",
      schema_name: "schema1",
      totalRows: 50,
      columns: [
        { name: "id", type: "STRING" },
        { name: "note", type: "STRING" },
      ],
    });
  });

  it("should handle missing columns in data", () => {
    const mockData = {
      status: 200,
      body: [
        {
          name: "measurements",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 1000,
          data: {
            rows: [],
          },
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables("exp-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.tables[0].columns).toEqual([]);
  });

  it("should handle error state", () => {
    const mockError = {
      status: 500,
      message: "Internal server error",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables("exp-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.tables).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });
});
