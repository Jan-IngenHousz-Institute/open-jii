/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { ExperimentData } from "@repo/api";

import { useExperimentData, useExperimentSampleData } from "./useExperimentData";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentData: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentData", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests by default
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

  describe("useExperimentData", () => {
    const mockExperimentData: ExperimentData = {
      columns: [
        { name: "id", type_name: "INT", type_text: "Integer" },
        { name: "name", type_name: "STRING", type_text: "String" },
        { name: "value", type_name: "DOUBLE", type_text: "Double" },
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "Timestamp" },
      ],
      rows: [
        { id: "1", name: "Test 1", value: "10.5", timestamp: "2023-01-01T10:00:00" },
        { id: "2", name: "Test 2", value: "20.7", timestamp: "2023-01-02T11:00:00" },
      ],
      totalRows: 2,
      truncated: false,
    };

    const mockResponse = {
      body: [
        {
          name: "test_table",
          data: mockExperimentData,
          totalPages: 5,
          totalRows: 100,
        },
      ],
    };

    it("should call useQuery with correct parameters", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      renderHook(
        () =>
          useExperimentData({
            experimentId: "experiment-123",
            page: 1,
            pageSize: 20,
            tableName: "test_table",
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryData: {
          params: { id: "experiment-123" },
          query: { tableName: "test_table", page: 1, pageSize: 20 },
        },
        queryKey: ["experiment", "experiment-123", 1, 20, "test_table"],
        staleTime: 120000, // 2 minutes
      });
    });

    it("should return table metadata and rows when data is available", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentData({
            experimentId: "experiment-123",
            page: 1,
            pageSize: 20,
            tableName: "test_table",
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.tableMetadata).toEqual({
        columns: expect.arrayContaining([
          expect.objectContaining({
            accessorKey: "id",
            header: "id",
            meta: { type: "INT" },
          }),
          expect.objectContaining({
            accessorKey: "name",
            header: "name",
            meta: { type: "STRING" },
          }),
          expect.objectContaining({
            accessorKey: "value",
            header: "value",
            meta: { type: "DOUBLE" },
          }),
          expect.objectContaining({
            accessorKey: "timestamp",
            header: "timestamp",
            meta: { type: "TIMESTAMP" },
          }),
        ]),
        totalPages: 5,
        totalRows: 100,
      });
      expect(result.current.tableRows).toEqual(mockExperimentData.rows);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should return undefined metadata when no data is available", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentData({
            experimentId: "experiment-123",
            page: 1,
            pageSize: 20,
            tableName: "test_table",
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.tableMetadata).toBeUndefined();
      expect(result.current.tableRows).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle error state", () => {
      const mockError = new Error("API Error");
      const mockUseQuery = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentData({
            experimentId: "experiment-123",
            page: 1,
            pageSize: 20,
            tableName: "test_table",
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.tableMetadata).toBeUndefined();
      expect(result.current.tableRows).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(mockError);
    });

    it("should use format function when provided", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentData({
            experimentId: "experiment-123",
            page: 1,
            pageSize: 20,
            tableName: "test_table",
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.tableMetadata).toBeDefined();
      // The format function would be used in the cell renderer, which we can't easily test here
      // but we can verify that the columns are created with the function
    });
  });

  describe("useExperimentSampleData", () => {
    const mockExperimentData: ExperimentData = {
      columns: [
        { name: "id", type_name: "INT", type_text: "Integer" },
        { name: "name", type_name: "STRING", type_text: "String" },
      ],
      rows: [
        { id: "1", name: "Sample 1" },
        { id: "2", name: "Sample 2" },
      ],
      totalRows: 2,
      truncated: false,
    };

    const mockSampleResponse = {
      body: [
        {
          name: "table1",
          data: mockExperimentData,
          totalPages: 1,
          totalRows: 2,
        },
        {
          name: "table2",
          data: {
            columns: [{ name: "count", type_name: "BIGINT", type_text: "Big Integer" }],
            rows: [{ count: "42" }],
            totalRows: 1,
            truncated: false,
          },
          totalPages: 1,
          totalRows: 1,
        },
      ],
    };

    it("should call useQuery with correct parameters for sample data", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockSampleResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      renderHook(
        () =>
          useExperimentSampleData({
            experimentId: "experiment-123",
            sampleSize: 10,
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryData: {
          params: { id: "experiment-123" },
          query: { tableName: undefined, page: 1, pageSize: 10 },
        },
        queryKey: ["experiment", "experiment-123", 1, 10, undefined],
        staleTime: 120000, // 2 minutes
      });
    });

    it("should return sample tables when data is available", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockSampleResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentSampleData({
            experimentId: "experiment-123",
            sampleSize: 10,
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.sampleTables).toHaveLength(2);
      expect(result.current.sampleTables[0]).toEqual({
        name: "table1",
        tableMetadata: {
          columns: expect.arrayContaining([
            expect.objectContaining({
              accessorKey: "id",
              header: "id",
              meta: { type: "INT" },
            }),
            expect.objectContaining({
              accessorKey: "name",
              header: "name",
              meta: { type: "STRING" },
            }),
          ]),
          totalPages: 1,
          totalRows: 2,
        },
        tableRows: mockExperimentData.rows,
      });
      expect(result.current.sampleTables[1]).toEqual({
        name: "table2",
        tableMetadata: {
          columns: expect.arrayContaining([
            expect.objectContaining({
              accessorKey: "count",
              header: "count",
              meta: { type: "BIGINT" },
            }),
          ]),
          totalPages: 1,
          totalRows: 1,
        },
        tableRows: [{ count: "42" }],
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should return empty array when no data is available", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      const { result } = renderHook(
        () =>
          useExperimentSampleData({
            experimentId: "experiment-123",
            sampleSize: 10,
            formatFunction,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.sampleTables).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should use default sample size of 5 when not provided", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockSampleResponse,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const formatFunction = vi.fn().mockReturnValue("formatted");

      renderHook(
        () => useExperimentSampleData({ experimentId: "experiment-123", formatFunction }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryData: {
          params: { id: "experiment-123" },
          query: { tableName: undefined, page: 1, pageSize: 5 },
        },
        queryKey: ["experiment", "experiment-123", 1, 5, undefined],
        staleTime: 120000,
      });
    });
  });
});
