/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useTransferRequestCreate } from "./useTransferRequestCreate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      createTransferRequest: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr;

describe("useTransferRequestCreate", () => {
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

    (mockTsr.useQueryClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQueryClient);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) =
      mockUseMutation;

    renderHook(() => useTransferRequestCreate(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSuccess: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  describe("onMutate callback", () => {
    it("should cancel queries and return previous requests", async () => {
      const mockPreviousRequests = [{ requestId: "req-1", status: "pending" }];
      mockGetQueryData.mockReturnValue(mockPreviousRequests);

      let onMutate: (() => Promise<{ previousRequests: typeof mockPreviousRequests }>) | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: { onMutate: () => Promise<{ previousRequests: typeof mockPreviousRequests }> }) => {
          onMutate = opts.onMutate;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate(), { wrapper: createWrapper() });

      const result = await onMutate?.();

      expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ["transferRequests"] });
      expect(mockGetQueryData).toHaveBeenCalledWith(["transferRequests"]);
      expect(result).toEqual({ previousRequests: mockPreviousRequests });
    });
  });

  describe("onError callback", () => {
    it("should revert to previous requests when context has previousRequests", () => {
      const mockOnError = vi.fn();
      let onError:
        | ((error: Error, variables: unknown, context?: { previousRequests?: unknown }) => void)
        | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: {
          onError: (
            error: Error,
            variables: unknown,
            context?: { previousRequests?: unknown },
          ) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate({ onError: mockOnError }), {
        wrapper: createWrapper(),
      });

      const error = new Error("Creation failed");
      const variables = { body: { projectIdOld: "123", projectUrlOld: "https://test.com" } };
      const context = { previousRequests: [{ requestId: "req-1" }] };

      onError?.(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(["transferRequests"], [{ requestId: "req-1" }]);
      expect(mockOnError).toHaveBeenCalledWith(error);
    });

    it("should not revert data when context has no previousRequests", () => {
      let onError:
        | ((error: Error, variables: unknown, context?: { previousRequests?: unknown }) => void)
        | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: {
          onError: (
            error: Error,
            variables: unknown,
            context?: { previousRequests?: unknown },
          ) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate(), { wrapper: createWrapper() });

      const error = new Error("Creation failed");
      const variables = {};
      const context = {};

      onError?.(error, variables, context);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("should call provided onError callback", () => {
      const mockOnError = vi.fn();
      let onError:
        | ((error: Error, variables: unknown, context?: { previousRequests?: unknown }) => void)
        | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: {
          onError: (
            error: Error,
            variables: unknown,
            context?: { previousRequests?: unknown },
          ) => void;
        }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate({ onError: mockOnError }), {
        wrapper: createWrapper(),
      });

      const error = new Error("Creation failed");

      onError?.(error, {}, undefined);

      expect(mockOnError).toHaveBeenCalledWith(error);
    });
  });

  describe("onSuccess callback", () => {
    it("should call provided onSuccess callback with requestId", () => {
      const mockOnSuccess = vi.fn();
      let onSuccess: ((data: { body: { requestId: string } }) => void) | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: { onSuccess: (data: { body: { requestId: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate({ onSuccess: mockOnSuccess }), {
        wrapper: createWrapper(),
      });

      const successData = { body: { requestId: "req-123" } };
      onSuccess?.(successData);

      expect(mockOnSuccess).toHaveBeenCalledWith("req-123");
    });

    it("should work without onSuccess callback", () => {
      let onSuccess: ((data: { body: { requestId: string } }) => void) | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: { onSuccess: (data: { body: { requestId: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate(), { wrapper: createWrapper() });

      const successData = { body: { requestId: "req-123" } };

      expect(() => onSuccess?.(successData)).not.toThrow();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate transfer requests queries", async () => {
      let onSettled: (() => Promise<void>) | undefined;

      (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi.fn(
        (opts: { onSettled: () => Promise<void> }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useTransferRequestCreate(), { wrapper: createWrapper() });

      await onSettled?.();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["transferRequests"],
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

    (mockTsr.experiments.createTransferRequest.useMutation as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockMutationResult);

    const { result } = renderHook(() => useTransferRequestCreate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutationResult);
  });
});
