/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr, getContractError } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { toast } from "@repo/ui/hooks";

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
  getContractError: vi.fn(),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

const mockTsr = tsr;
const mockGetContractError = vi.mocked(getContractError);
const mockToast = vi.mocked(toast);

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
      expect(mockOnSuccess).toHaveBeenCalledWith(result);
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
    it("should call onError option when provided with a contract error", () => {
      let onError: ((error: unknown) => void) | undefined;
      const mockOnError = vi.fn();

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: unknown) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      const contractError = { status: 409, body: { message: "Conflict" }, headers: new Headers() };
      mockGetContractError.mockReturnValue(contractError as never);

      renderHook(() => useMacroCreate({ onError: mockOnError }), { wrapper: createWrapper() });

      onError?.({});

      expect(mockOnError).toHaveBeenCalledWith(contractError);
      expect(mockToast).toHaveBeenCalledWith({
        description: "macros.nameAlreadyExists",
        variant: "destructive",
      });
    });

    it("shows createError toast for non-409 contract errors", () => {
      let onError: ((error: unknown) => void) | undefined;

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: unknown) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      const contractError = { status: 422, body: {}, headers: new Headers() };
      mockGetContractError.mockReturnValue(contractError as never);

      renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

      onError?.(contractError);

      expect(mockToast).toHaveBeenCalledWith({
        description: "macros.createError",
        variant: "destructive",
      });
    });

    it("shows server error toast when getContractError returns undefined", () => {
      let onError: ((error: unknown) => void) | undefined;

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: unknown) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

      onError?.(new Error("network"));

      expect(mockToast).toHaveBeenCalledWith({
        description: "common.errors.serverError",
        variant: "destructive",
      });
    });

    it("should not call onError option when error is not a contract error", () => {
      let onError: ((error: unknown) => void) | undefined;
      const mockOnError = vi.fn();

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: unknown) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useMacroCreate({ onError: mockOnError }), { wrapper: createWrapper() });

      onError?.(new Error("non-contract error"));

      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should work when onError option is not provided", () => {
      let onError: ((error: unknown) => void) | undefined;

      (mockTsr.macros.createMacro.useMutation as unknown) = vi.fn(
        (opts: { onError: (error: unknown) => void }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useMacroCreate(), { wrapper: createWrapper() });

      // This should not throw
      onError?.(new Error("Create failed"));
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
