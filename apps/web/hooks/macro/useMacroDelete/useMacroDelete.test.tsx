/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useMacroDelete } from "./useMacroDelete";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    macros: {
      deleteMacro: {
        useMutation: vi.fn(),
      },
    },
  },
}));

interface MutateVariables {
  params: { id: string };
}

const mockTsr = tsr;

describe("useMacroDelete", () => {
  let queryClient: QueryClient;
  const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();
  const mockRemoveQueries = vi.fn();
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
      removeQueries: mockRemoveQueries,
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.macros.deleteMacro.useMutation as unknown) = mockUseMutation;

    renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  describe("onMutate callback", () => {
    it("should cancel queries, remove macro from cache, and return previous data", async () => {
      const mockPreviousMacros = {
        body: [
          { id: "macro-123", name: "Test Macro 1" },
          { id: "macro-456", name: "Test Macro 2" },
        ],
      };
      mockGetQueryData.mockReturnValue(mockPreviousMacros);

      let onMutate:
        | ((variables: MutateVariables) => Promise<{ previousMacros: typeof mockPreviousMacros }>)
        | undefined;

      (mockTsr.macros.deleteMacro.useMutation as unknown) = vi.fn(
        (opts: {
          onMutate: (
            variables: MutateVariables,
          ) => Promise<{ previousMacros: typeof mockPreviousMacros }>;
        }) => {
          onMutate = opts.onMutate;
          return {};
        },
      );

      renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

      const variables = { params: { id: "macro-123" } };
      const result = await onMutate?.(variables);

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["macros"],
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(["macros"]);
      expect(mockSetQueryData).toHaveBeenCalledWith(["macros"], {
        body: [{ id: "macro-456", name: "Test Macro 2" }],
      });
      expect(mockRemoveQueries).toHaveBeenCalledWith({
        queryKey: ["macro", "macro-123"],
      });
      expect(result).toEqual({ previousMacros: mockPreviousMacros });
    });

    it("should not modify query data if previous macros data is not available", async () => {
      mockGetQueryData.mockReturnValue(undefined);

      let onMutate:
        | ((variables: MutateVariables) => Promise<{ previousMacros: typeof undefined }>)
        | undefined;

      (mockTsr.macros.deleteMacro.useMutation as unknown) = vi.fn(
        (opts: {
          onMutate: (variables: MutateVariables) => Promise<{ previousMacros: undefined }>;
        }) => {
          onMutate = opts.onMutate;
          return {};
        },
      );

      renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

      const variables = { params: { id: "macro-123" } };
      await onMutate?.(variables);

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["macros"],
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(["macros"]);
      expect(mockSetQueryData).not.toHaveBeenCalled();
      expect(mockRemoveQueries).toHaveBeenCalledWith({
        queryKey: ["macro", "macro-123"],
      });
    });
  });

  describe("onError callback", () => {
    it("should revert to previous macros when context has previousMacros", () => {
      let onError:
        | ((
            error: Error,
            variables: MutateVariables,
            context?: { previousMacros?: unknown },
          ) => void)
        | undefined;

      (mockTsr.macros.deleteMacro.useMutation as unknown) = vi.fn(
        (opts: {
          onError: (
            error: Error,
            variables: MutateVariables,
            context?: { previousMacros?: unknown },
          ) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

      const error = new Error("Delete failed");
      const variables = { params: { id: "macro-123" } };
      const context = { previousMacros: { body: [{ id: "macro-123", name: "Test Macro" }] } };

      onError?.(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(["macros"], context.previousMacros);
    });

    it("should not revert data when context has no previousMacros", () => {
      let onError:
        | ((
            error: Error,
            variables: MutateVariables,
            context?: { previousMacros?: unknown },
          ) => void)
        | undefined;

      (mockTsr.macros.deleteMacro.useMutation as unknown) = vi.fn(
        (opts: {
          onError: (
            error: Error,
            variables: MutateVariables,
            context?: { previousMacros?: unknown },
          ) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

      const error = new Error("Delete failed");
      const variables = { params: { id: "macro-123" } };
      const context = {};

      onError?.(error, variables, context);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate macros queries", async () => {
      let onSettled: (() => Promise<void>) | undefined;

      (mockTsr.macros.deleteMacro.useMutation as unknown) = vi.fn(
        (opts: { onSettled: () => Promise<void> }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useMacroDelete(), { wrapper: createWrapper() });

      await onSettled?.();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["macros"],
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

    (mockTsr.macros.deleteMacro.useMutation as unknown) = vi
      .fn()
      .mockReturnValue(mockMutationResult);

    const { result } = renderHook(() => useMacroDelete(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutationResult);
  });
});
