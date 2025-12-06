/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentAnnotationAdd } from "./useExperimentAnnotationAdd";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      addAnnotation: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentAnnotationAdd", () => {
  let queryClient: QueryClient;

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

    const mockInvalidateQueries = vi.fn();
    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);
  });

  it("should return mutation from tsr", () => {
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
    };

    mockTsr.experiments.addAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAdd(), { wrapper: createWrapper() });

    expect(result.current).toBe(mockMutation);
    expect(mockTsr.experiments.addAnnotation.useMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });

  it("should handle successful annotation creation", () => {
    const mockData = { id: "annotation-123", rowsAffected: 1 };
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: mockData,
      error: null,
    };

    mockTsr.experiments.addAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAdd(), { wrapper: createWrapper() });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe(mockData);
  });

  it("should handle mutation errors gracefully", () => {
    const mockError = new Error("Add annotation failed");
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: mockError,
    };

    mockTsr.experiments.addAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAdd(), { wrapper: createWrapper() });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
  });

  it("should call onSuccess callback and invalidate queries", async () => {
    const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    let onSuccessCallback: (() => Promise<void>) | undefined;

    mockTsr.experiments.addAnnotation.useMutation = vi.fn().mockImplementation(({ onSuccess }) => {
      onSuccessCallback = onSuccess;
      return {
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
      };
    }) as any;

    renderHook(() => useExperimentAnnotationAdd(), { wrapper: createWrapper() });

    // Verify onSuccess callback was passed
    expect(onSuccessCallback).toBeDefined();

    // Call the onSuccess callback and verify it invalidates queries
    await onSuccessCallback?.();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["experiment"] });
  });
});
