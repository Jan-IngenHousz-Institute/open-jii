/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useMacroCreate } from "./useMacroCreate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    macros: {
      createMacro: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr;

describe("useMacroCreate", () => {
  let queryClient: QueryClient;
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
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.macros.createMacro.useMutation as unknown) = mockUseMutation;

    renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  describe("onSuccess callback", () => {
    it("should invalidate macros queries and call onSuccess option", () => {
      let onSuccess: ((result: { body: { id: string } }) => void) | undefined;
      const mockOnSuccess = vi.fn();

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onSuccess: (result: { body: { id: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useMacroCreate({ onSuccess: mockOnSuccess }), { wrapper: createWrapper() });

      const result = { body: { id: "macro-123" } };
      onSuccess?.(result);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["macros"],
      });
      expect(mockOnSuccess).toHaveBeenCalledWith("macro-123");
    });

    it("should work when onSuccess option is not provided", () => {
      let onSuccess: ((result: { body: { id: string } }) => void) | undefined;

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onSuccess: (result: { body: { id: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

      const result = { body: { id: "macro-123" } };

      // This should not throw
      onSuccess?.(result);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["macros"],
      });
    });
  });

  describe("onError callback", () => {
    it("should call onError option when provided", () => {
      let onError: ((error: Error) => void) | undefined;
      const mockOnError = vi.fn();

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: Error) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useMacroCreate({ onError: mockOnError }), { wrapper: createWrapper() });

      const error = new Error("Create failed");
      onError?.(error);

      expect(mockOnError).toHaveBeenCalledWith(error);
    });

    it("should work when onError option is not provided", () => {
      let onError: ((error: Error) => void) | undefined;

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: Error) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

      const error = new Error("Create failed");

      // This should not throw
      onError?.(error);
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

    (mockTsr.macros.createMacro.useMutation as unknown) = vi
      .fn()
      .mockReturnValue(mockMutationResult);

    const { result } = renderHook(() => useMacroCreate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutationResult);
  });
});
