/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentVisualizationUpdate } from "./useExperimentVisualizationUpdate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      updateExperimentVisualization: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useExperimentVisualizationUpdate", () => {
  let queryClient: QueryClient;
  const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryClient = {
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient.mockReturnValue(mockQueryClient);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    mockTsr.experiments.updateExperimentVisualization.useMutation = mockUseMutation;

    renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
      onSuccess: expect.any(Function),
    });
  });

  describe("onMutate callback", () => {
    it("should cancel queries and return previous data", async () => {
      const mockPreviousData = {
        body: [{ id: "viz-1", name: "Existing Visualization" }],
      };
      mockGetQueryData.mockReturnValue(mockPreviousData);

      let onMutate: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onMutate = opts.onMutate;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      const result = await onMutate();

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["experiment-visualizations", "exp-123"],
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(["experiment-visualizations", "exp-123"]);
      expect(result).toEqual({ previousVisualizations: mockPreviousData });
    });
  });

  describe("onError callback", () => {
    it("should revert to previous data when context has previousVisualizations", () => {
      let onError: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      const error = new Error("Update failed");
      const variables = {};
      const context = {
        previousVisualizations: { body: [{ id: "viz-1" }] },
      };

      onError(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(
        ["experiment-visualizations", "exp-123"],
        context.previousVisualizations,
      );
    });

    it("should not revert data when context has no previousVisualizations", () => {
      let onError: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      const error = new Error("Update failed");
      const variables = {};
      const context = {};

      onError(error, variables, context);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("should not revert data when context is undefined", () => {
      let onError: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      const error = new Error("Update failed");
      const variables = {};

      onError(error, variables, undefined);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate queries after mutation", async () => {
      let onSettled: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onSettled = opts.onSettled;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      await onSettled();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiment-visualizations", "exp-123"],
      });
    });
  });

  describe("onSuccess callback", () => {
    it("should call onSuccess callback when provided", () => {
      const mockOnSuccess = vi.fn();
      let onSuccess: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return {};
      });

      renderHook(
        () =>
          useExperimentVisualizationUpdate({
            experimentId: "exp-123",
            onSuccess: mockOnSuccess,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      const mockVisualization = {
        id: "viz-123",
        name: "Updated Visualization",
        chartType: "scatter",
      };
      const data = { body: mockVisualization };

      onSuccess(data);

      expect(mockOnSuccess).toHaveBeenCalledWith(mockVisualization);
    });

    it("should not throw when onSuccess callback not provided", () => {
      let onSuccess: any;

      mockTsr.experiments.updateExperimentVisualization.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return {};
      });

      renderHook(() => useExperimentVisualizationUpdate({ experimentId: "exp-123" }), {
        wrapper: createWrapper(),
      });

      const data = { body: { id: "viz-123" } };

      expect(() => onSuccess(data)).not.toThrow();
    });
  });
});
