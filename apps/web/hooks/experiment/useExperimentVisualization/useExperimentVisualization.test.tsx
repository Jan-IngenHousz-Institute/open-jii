/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentVisualization } from "./useExperimentVisualization";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentVisualization: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useExperimentVisualization", () => {
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
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    renderHook(() => useExperimentVisualization("viz-123", "exp-456"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "exp-456", visualizationId: "viz-123" },
      },
      queryKey: ["experiment-visualization", "exp-456", "viz-123"],
    });
  });

  it("should return successful visualization data", () => {
    const mockData = {
      status: 200,
      body: {
        id: "viz-123",
        name: "Test Visualization",
        chartType: "line",
        chartFamily: "basic",
        configuration: {},
        experimentId: "exp-456",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualization("viz-123", "exp-456"), {
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
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualization("viz-123", "exp-456"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = {
      status: 404,
      message: "Visualization not found",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentVisualization("viz-123", "exp-456"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it("should use different query keys for different visualization IDs", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    const { rerender } = renderHook(
      ({ vizId, expId }) => useExperimentVisualization(vizId, expId),
      {
        initialProps: { vizId: "viz-1", expId: "exp-1" },
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experiment-visualization", "exp-1", "viz-1"],
      }),
    );

    rerender({ vizId: "viz-2", expId: "exp-1" });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experiment-visualization", "exp-1", "viz-2"],
      }),
    );
  });

  it("should use different query keys for different experiment IDs", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentVisualization.useQuery = mockUseQuery;

    const { rerender } = renderHook(
      ({ vizId, expId }) => useExperimentVisualization(vizId, expId),
      {
        initialProps: { vizId: "viz-1", expId: "exp-1" },
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experiment-visualization", "exp-1", "viz-1"],
      }),
    );

    rerender({ vizId: "viz-1", expId: "exp-2" });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experiment-visualization", "exp-2", "viz-1"],
      }),
    );
  });
});
