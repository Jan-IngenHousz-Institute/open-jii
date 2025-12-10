/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentAnnotationDelete } from "./useExperimentAnnotationDelete";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      deleteAnnotation: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentAnnotationDelete", () => {
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

    mockTsr.experiments.deleteAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationDelete(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutation);
    expect(mockTsr.experiments.deleteAnnotation.useMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  it("should handle successful annotation deletion", () => {
    const mockData = { success: true };
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: mockData,
      error: null,
    };

    mockTsr.experiments.deleteAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationDelete(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe(mockData);
  });

  it("should handle mutation errors gracefully", () => {
    const mockError = new Error("Delete annotation failed");
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: mockError,
    };

    mockTsr.experiments.deleteAnnotation.useMutation = vi.fn().mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationDelete(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
  });

  it("should handle optimistic updates with onMutate and onError", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueriesData = vi.fn().mockReturnValue([]);
    const mockSetQueriesData = vi.fn();
    const mockSetQueryData = vi.fn();
    const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

    mockTsr.useQueryClient.mockReturnValue({
      cancelQueries: mockCancelQueries,
      getQueriesData: mockGetQueriesData,
      setQueriesData: mockSetQueriesData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    } as any);

    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;
    let onErrorCallback: ((error: any, variables: any, context: any) => Promise<void>) | undefined;

    mockTsr.experiments.deleteAnnotation.useMutation = vi
      .fn()
      .mockImplementation(({ onMutate, onError }) => {
        onMutateCallback = onMutate;
        onErrorCallback = onError;
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

    renderHook(() => useExperimentAnnotationDelete(), { wrapper: createWrapper() });

    // Verify onMutate callback was passed
    expect(onMutateCallback).toBeDefined();
    expect(onErrorCallback).toBeDefined();

    // Test onMutate behavior
    const mockVariables = { params: { id: "exp-123", annotationId: "ann-456" } };
    await onMutateCallback?.(mockVariables);

    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-123"] });
    expect(mockGetQueriesData).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-123"] });
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ["experiment", "exp-123"] },
      expect.any(Function),
    );
  });

  it("should execute onMutate callback with experiment data for delete", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueriesData = vi.fn().mockReturnValue([["experiment-key", { some: "data" }]]);
    const mockSetQueriesData = vi.fn();
    const mockSetQueryData = vi.fn();
    const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

    mockTsr.useQueryClient.mockReturnValue({
      cancelQueries: mockCancelQueries,
      getQueriesData: mockGetQueriesData,
      setQueriesData: mockSetQueriesData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    } as any);

    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;

    mockTsr.experiments.deleteAnnotation.useMutation = vi
      .fn()
      .mockImplementation(({ onMutate }) => {
        onMutateCallback = onMutate;
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

    renderHook(() => useExperimentAnnotationDelete(), { wrapper: createWrapper() });

    const mockVariables = {
      params: { id: "exp-123", annotationId: "ann-456" },
    };

    const result = await onMutateCallback?.(mockVariables);

    expect(result).toEqual({ previousData: [["experiment-key", { some: "data" }]] });
    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-123"] });
    expect(mockGetQueriesData).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-123"] });
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ["experiment", "exp-123"] },
      expect.any(Function),
    );
  });

  it("should execute onMutate callback optimistic update function with valid data for delete", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueriesData = vi.fn().mockReturnValue([]);
    let setQueriesDataCallback: ((oldData: unknown) => unknown) | undefined;
    const mockSetQueriesData = vi.fn().mockImplementation((_queryKey, callback) => {
      setQueriesDataCallback = callback;
    });

    mockTsr.useQueryClient.mockReturnValue({
      cancelQueries: mockCancelQueries,
      getQueriesData: mockGetQueriesData,
      setQueriesData: mockSetQueriesData,
    } as any);

    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;

    mockTsr.experiments.deleteAnnotation.useMutation = vi
      .fn()
      .mockImplementation(({ onMutate }) => {
        onMutateCallback = onMutate;
        return { mutate: vi.fn() };
      }) as any;

    renderHook(() => useExperimentAnnotationDelete(), { wrapper: createWrapper() });

    const mockVariables = {
      params: { id: "exp-123", annotationId: "ann-456" },
    };

    await onMutateCallback?.(mockVariables);

    // Test the setQueriesData callback with valid experiment data
    const mockExperimentData = {
      body: [
        {
          data: {
            columns: [{ name: "annotations", type_text: "annotations" }],
            name: "table1",
            data: { rows: [{ id: "row1", annotations: '[{"id":"ann-456","text":"test"}]' }] },
          },
        },
      ],
    };

    const result = setQueriesDataCallback?.(mockExperimentData);
    expect(result).toBeDefined();
  });

  it("should return original data in onMutate callback when no experiment data for delete", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueriesData = vi.fn().mockReturnValue([]);
    let setQueriesDataCallback: ((oldData: unknown) => unknown) | undefined;
    const mockSetQueriesData = vi.fn().mockImplementation((_queryKey, callback) => {
      setQueriesDataCallback = callback;
    });

    mockTsr.useQueryClient.mockReturnValue({
      cancelQueries: mockCancelQueries,
      getQueriesData: mockGetQueriesData,
      setQueriesData: mockSetQueriesData,
    } as any);

    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;

    mockTsr.experiments.deleteAnnotation.useMutation = vi
      .fn()
      .mockImplementation(({ onMutate }) => {
        onMutateCallback = onMutate;
        return { mutate: vi.fn() };
      }) as any;

    renderHook(() => useExperimentAnnotationDelete(), { wrapper: createWrapper() });

    await onMutateCallback?.({
      params: { id: "exp-123", annotationId: "ann-456" },
    });

    // Test with invalid data
    const invalidData = { body: [{ data: null }] };
    const result = setQueriesDataCallback?.(invalidData);
    expect(result).toBe(invalidData);
  });

  it("should execute onError callback with context and rollback for delete", async () => {
    const mockSetQueryData = vi.fn();
    const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

    mockTsr.useQueryClient.mockReturnValue({
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    } as any);

    let onErrorCallback: ((error: any, variables: any, context: any) => Promise<void>) | undefined;

    mockTsr.experiments.deleteAnnotation.useMutation = vi.fn().mockImplementation(({ onError }) => {
      onErrorCallback = onError;
      return { mutate: vi.fn() };
    }) as any;

    renderHook(() => useExperimentAnnotationDelete(), { wrapper: createWrapper() });

    const mockError = new Error("Test error");
    const mockVariables = { params: { id: "exp-123", annotationId: "ann-456" } };
    const mockContext = {
      previousData: [
        ["query-key-1", { some: "data1" }],
        ["query-key-2", { some: "data2" }],
      ],
    };

    await onErrorCallback?.(mockError, mockVariables, mockContext);

    expect(mockSetQueryData).toHaveBeenCalledTimes(2);
    expect(mockSetQueryData).toHaveBeenCalledWith("query-key-1", { some: "data1" });
    expect(mockSetQueryData).toHaveBeenCalledWith("query-key-2", { some: "data2" });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-123"] });
  });
});
