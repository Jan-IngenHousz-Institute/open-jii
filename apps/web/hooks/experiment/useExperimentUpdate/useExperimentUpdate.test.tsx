/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentUpdate } from "./useExperimentUpdate";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      updateExperiment: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentUpdate", () => {
  const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryClient = {
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as any);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    mockTsr.experiments.updateExperiment.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentUpdate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  it("should return mutation result", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: null,
      data: undefined,
    };

    mockTsr.experiments.updateExperiment.useMutation = vi
      .fn()
      .mockReturnValue(mockMutationResult) as any;

    const { result } = renderHook(() => useExperimentUpdate());

    expect(result.current).toBe(mockMutationResult);
  });

  describe("onMutate callback", () => {
    it("should cancel queries and optimistically update experiment cache", async () => {
      const mockPreviousExperiment = {
        body: {
          id: "exp-123",
          name: "Old Name",
          description: "Old Description",
        },
      };

      mockGetQueryData.mockImplementation((key: any) => {
        if (key[0] === "experiment") return mockPreviousExperiment;
        return undefined;
      });

      let onMutate: ((variables: any) => Promise<any>) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onMutate = opts.onMutate;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const variables = {
        params: { id: "exp-123" },
        body: { name: "New Name" },
      };

      const result = await onMutate?.(variables);

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["experiment", "exp-123"],
      });

      expect(mockSetQueryData).toHaveBeenCalledWith(["experiment", "exp-123"], {
        body: {
          id: "exp-123",
          name: "New Name",
          description: "Old Description",
        },
      });

      expect(result).toEqual({
        previousExperiment: mockPreviousExperiment,
        previousExperiments: undefined,
      });
    });

    it("should optimistically update experiments list cache", async () => {
      const mockPreviousExperiments = {
        body: [
          { id: "exp-123", name: "Old Name" },
          { id: "exp-456", name: "Other Experiment" },
        ],
      };

      mockGetQueryData.mockImplementation((key: any) => {
        if (key[0] === "experiments") return mockPreviousExperiments;
        return undefined;
      });

      let onMutate: ((variables: any) => Promise<any>) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onMutate = opts.onMutate;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const variables = {
        params: { id: "exp-123" },
        body: { name: "New Name" },
      };

      await onMutate?.(variables);

      expect(mockSetQueryData).toHaveBeenCalledWith(["experiments"], {
        body: [
          { id: "exp-123", name: "New Name" },
          { id: "exp-456", name: "Other Experiment" },
        ],
      });
    });

    it("should not update cache when no previous data exists", async () => {
      mockGetQueryData.mockReturnValue(undefined);

      let onMutate: ((variables: any) => Promise<any>) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onMutate = opts.onMutate;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const variables = {
        params: { id: "exp-123" },
        body: { name: "New Name" },
      };

      await onMutate?.(variables);

      expect(mockCancelQueries).toHaveBeenCalled();
      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onError callback", () => {
    it("should revert experiment cache when context has previous data", () => {
      const mockPreviousExperiment = {
        body: { id: "exp-123", name: "Old Name" },
      };

      let onError: ((error: Error, variables: any, context?: any) => void) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const error = new Error("Update failed");
      const variables = { params: { id: "exp-123" }, body: { name: "New Name" } };
      const context = { previousExperiment: mockPreviousExperiment };

      onError?.(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(
        ["experiment", "exp-123"],
        mockPreviousExperiment,
      );
    });

    it("should revert experiments list cache when context has previous data", () => {
      const mockPreviousExperiments = {
        body: [{ id: "exp-123", name: "Old Name" }],
      };

      let onError: ((error: Error, variables: any, context?: any) => void) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const error = new Error("Update failed");
      const variables = { params: { id: "exp-123" }, body: { name: "New Name" } };
      const context = { previousExperiments: mockPreviousExperiments };

      onError?.(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(["experiments"], mockPreviousExperiments);
    });

    it("should not revert when context is undefined", () => {
      let onError: ((error: Error, variables: any, context?: any) => void) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const error = new Error("Update failed");
      const variables = { params: { id: "exp-123" }, body: { name: "New Name" } };

      onError?.(error, variables, undefined);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate all related queries", async () => {
      let onSettled: ((data: any, error: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onSettled = opts.onSettled;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const variables = { params: { id: "exp-123" }, body: { name: "New Name" } };

      await onSettled?.(undefined, undefined, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiment", "exp-123"],
        exact: true,
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experimentAccess", "exp-123"],
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments"],
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["breadcrumbs"],
      });
    });

    it("should invalidate queries even when there is an error", async () => {
      let onSettled: ((data: any, error: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.updateExperiment.useMutation = vi.fn((opts: any) => {
        onSettled = opts.onSettled;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useExperimentUpdate());

      const error = new Error("Update failed");
      const variables = { params: { id: "exp-123" }, body: { name: "New Name" } };

      await onSettled?.(undefined, error, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiment", "exp-123"],
        exact: true,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experimentAccess", "exp-123"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["breadcrumbs"],
      });
    });
  });

  it("should handle pending state", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: true,
      error: null,
      data: undefined,
    };

    mockTsr.experiments.updateExperiment.useMutation = vi
      .fn()
      .mockReturnValue(mockMutationResult) as any;

    const { result } = renderHook(() => useExperimentUpdate());

    expect(result.current.isPending).toBe(true);
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to update experiment");
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: mockError,
      data: undefined,
    };

    mockTsr.experiments.updateExperiment.useMutation = vi
      .fn()
      .mockReturnValue(mockMutationResult) as any;

    const { result } = renderHook(() => useExperimentUpdate());

    expect(result.current.error).toBe(mockError);
  });
});
