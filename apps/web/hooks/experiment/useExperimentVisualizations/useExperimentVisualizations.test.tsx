/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentVisualizations } from "./useExperimentVisualizations";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      listExperimentVisualizations: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useExperimentVisualizations", () => {
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

  it("should initialize with default parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

    renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-123" },
        query: {
          chartFamily: undefined,
          limit: 50,
          offset: 0,
        },
      },
      queryKey: ["experiment-visualizations", "exp-123", undefined, 50, 0],
    });
  });

  it("should initialize with custom parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

    renderHook(
      () =>
        useExperimentVisualizations({
          experimentId: "exp-123",
          initialChartFamily: "basic",
          initialLimit: 10,
          initialOffset: 20,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-123" },
        query: {
          chartFamily: "basic",
          limit: 10,
          offset: 20,
        },
      },
      queryKey: ["experiment-visualizations", "exp-123", "basic", 10, 20],
    });
  });

  it("should return successful visualizations data", () => {
    const mockData = {
      status: 200,
      body: [
        {
          id: "viz-1",
          name: "Visualization 1",
          chartType: "line",
          chartFamily: "basic",
        },
        {
          id: "viz-2",
          name: "Visualization 2",
          chartType: "scatter",
          chartFamily: "basic",
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
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
    mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  describe("chartFamily filter", () => {
    it("should allow setting chart family filter", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.chartFamily).toBeUndefined();

      act(() => {
        result.current.setChartFamily("basic");
      });

      expect(result.current.chartFamily).toBe("basic");
    });

    it("should update query when chart family changes", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: undefined,
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.setChartFamily("basic");
      });

      expect(mockUseQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryData: expect.objectContaining({
            query: expect.objectContaining({
              chartFamily: "basic",
            }),
          }),
        }),
      );
    });
  });

  describe("pagination", () => {
    it("should have correct initial pagination state", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.limit).toBe(50);
      expect(result.current.offset).toBe(0);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("should detect next page when results equal limit", () => {
      const mockData = {
        body: Array.from({ length: 50 }, (_, i) => ({
          id: `viz-${i}`,
          name: `Visualization ${i}`,
        })),
      };

      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockData,
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.hasNextPage).toBe(true);
    });

    it("should not have next page when results less than limit", () => {
      const mockData = {
        body: Array.from({ length: 25 }, (_, i) => ({
          id: `viz-${i}`,
          name: `Visualization ${i}`,
        })),
      };

      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockData,
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.hasNextPage).toBe(false);
    });

    it("should go to next page", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: Array.from({ length: 50 }, () => ({})) },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.offset).toBe(50);
      expect(result.current.hasPreviousPage).toBe(true);
    });

    it("should not go to next page when hasNextPage is false", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: Array.from({ length: 25 }, () => ({})) },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should go to previous page", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () =>
          useExperimentVisualizations({
            experimentId: "exp-123",
            initialOffset: 50,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.offset).toBe(50);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should not go to previous page when offset is 0", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should reset pagination", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () =>
          useExperimentVisualizations({
            experimentId: "exp-123",
            initialOffset: 100,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.offset).toBe(100);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should allow setting custom limit", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.setLimit(25);
      });

      expect(result.current.limit).toBe(25);
    });

    it("should allow setting custom offset", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: { body: [] },
        error: null,
        isLoading: false,
      });
      mockTsr.experiments.listExperimentVisualizations.useQuery = mockUseQuery;

      const { result } = renderHook(
        () => useExperimentVisualizations({ experimentId: "exp-123" }),
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.setOffset(75);
      });

      expect(result.current.offset).toBe(75);
      expect(result.current.hasPreviousPage).toBe(true);
    });
  });
});
