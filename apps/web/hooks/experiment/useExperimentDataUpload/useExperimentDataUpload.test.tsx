/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentDataUpload } from "./useExperimentDataUpload";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      uploadExperimentData: {
        useMutation: vi.fn(),
      },
    },
  },
}));

interface MutateVariables {
  params: { id: string };
}

const mockTsr = tsr;

describe("useExperimentDataUpload", () => {
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

    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = mockUseMutation;

    renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSuccess: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  describe("onMutate callback", () => {
    it("should cancel queries and return previous data", async () => {
      const mockPreviousData = { data: "test-data" };
      mockGetQueryData.mockReturnValue(mockPreviousData);

      let onMutate: ((variables: MutateVariables) => Promise<{ previousData: typeof mockPreviousData }>) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onMutate: (variables: MutateVariables) => Promise<{ previousData: typeof mockPreviousData }>;
        }) => {
          onMutate = opts.onMutate;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const variables = { params: { id: "experiment-123" } };
      const result = await onMutate!(variables);

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["experiments", "experiment-123", "data"],
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(["experiments", "experiment-123", "data"]);
      expect(result).toEqual({ previousData: mockPreviousData });
    });
  });

  describe("onError callback", () => {
    it("should revert to previous data when context has previousData", () => {
      let onError: ((error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onError: (error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const error = new Error("Upload failed");
      const variables = { params: { id: "experiment-123" } };
      const context = { previousData: { data: "previous-data" } };

      onError!(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(
        ["experiments", "experiment-123", "data"],
        { data: "previous-data" }
      );
    });

    it("should not revert data when context has no previousData", () => {
      let onError: ((error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onError: (error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const error = new Error("Upload failed");
      const variables = { params: { id: "experiment-123" } };
      const context = {};

      onError!(error, variables, context);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("should not revert data when context is undefined", () => {
      let onError: ((error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onError: (error: Error, variables: MutateVariables, context?: { previousData?: unknown }) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const error = new Error("Upload failed");
      const variables = { params: { id: "experiment-123" } };

      onError!(error, variables, undefined);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onSuccess callback", () => {
    it("should log success and invalidate experiment queries", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      let onSuccess: ((data: unknown) => Promise<void>) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onSuccess: (data: unknown) => Promise<void>;
        }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const successData = { success: true, id: "upload-123" };
      await onSuccess!(successData);

      expect(consoleSpy).toHaveBeenCalledWith("Upload success response:", successData);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiment"],
      });

      consoleSpy.mockRestore();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate specific experiment queries", async () => {
      let onSettled: ((data: unknown, error: Error | null, variables: MutateVariables) => Promise<void>) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onSettled: (data: unknown, error: Error | null, variables: MutateVariables) => Promise<void>;
        }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const data = { success: true };
      const error = null;
      const variables = { params: { id: "experiment-123" } };

      await onSettled!(data, error, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments", "experiment-123", "data"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments", "experiment-123"],
      });
    });

    it("should invalidate queries even when there's an error", async () => {
      let onSettled: ((data: unknown, error: Error | null, variables: MutateVariables) => Promise<void>) | undefined;
      
      (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn(
        (opts: {
          onSettled: (data: unknown, error: Error | null, variables: MutateVariables) => Promise<void>;
        }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useExperimentDataUpload(), { wrapper: createWrapper() });

      const data = null;
      const error = new Error("Upload failed");
      const variables = { params: { id: "experiment-123" } };

      await onSettled!(data, error, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments", "experiment-123", "data"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiments", "experiment-123"],
      });
    });
  });

  it("should return the result of tsr mutation", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isLoading: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    };

    (mockTsr.experiments.uploadExperimentData.useMutation as unknown) = vi.fn().mockReturnValue(mockMutationResult);

    const { result } = renderHook(() => useExperimentDataUpload(), { 
      wrapper: createWrapper() 
    });

    expect(result.current).toBe(mockMutationResult);
  });
});
