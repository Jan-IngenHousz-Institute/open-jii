/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr, getContractError } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { toast } from "@repo/ui/hooks";

import { useProtocolCreate } from "./useProtocolCreate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    protocols: {
      createProtocol: {
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

describe("useProtocolCreate", () => {
  const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();

  const createWrapper = () => {
    const queryClient = new QueryClient({
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
      invalidateQueries: mockInvalidateQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.protocols.createProtocol.useMutation as unknown) = mockUseMutation;

    renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  describe("onMutate", () => {
    it("should cancel protocols queries and snapshot previous list", async () => {
      let onMutate: (() => Promise<{ previousProtocols: unknown }>) | undefined;
      const previous = { body: [{ id: "p1" }] };
      mockGetQueryData.mockReturnValue(previous);

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onMutate: () => Promise<{ previousProtocols: unknown }> }) => {
          onMutate = opts.onMutate;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      const ctx = await onMutate?.();

      expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ["protocols"] });
      expect(mockGetQueryData).toHaveBeenCalledWith(["protocols"]);
      expect(ctx).toEqual({ previousProtocols: previous });
    });
  });

  describe("onSuccess", () => {
    it("should toast and call onSuccess option", () => {
      let onSuccess: ((result: { body: { id: string } }) => void) | undefined;
      const mockOnSuccess = vi.fn();

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onSuccess: (result: { body: { id: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useProtocolCreate({ onSuccess: mockOnSuccess }), {
        wrapper: createWrapper(),
      });

      const result = { body: { id: "proto-1" } };
      onSuccess?.(result);

      expect(mockToast).toHaveBeenCalledWith({ description: "protocols.protocolCreated" });
      expect(mockOnSuccess).toHaveBeenCalledWith(result);
    });

    it("should work when onSuccess option is not provided", () => {
      let onSuccess: ((result: { body: { id: string } }) => void) | undefined;

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onSuccess: (result: { body: { id: string } }) => void }) => {
          onSuccess = opts.onSuccess;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onSuccess?.({ body: { id: "proto-1" } });

      expect(mockToast).toHaveBeenCalledWith({ description: "protocols.protocolCreated" });
    });
  });

  describe("onError", () => {
    it("rolls back query data when previousProtocols exists", () => {
      let onError: ((error: unknown, variables: unknown, context: unknown) => void) | undefined;
      const previous = { body: [{ id: "old" }] };

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onError?.({}, {}, { previousProtocols: previous });

      expect(mockSetQueryData).toHaveBeenCalledWith(["protocols"], previous);
    });

    it("does not rollback when previousProtocols is missing", () => {
      let onError: ((error: unknown, variables: unknown, context: unknown) => void) | undefined;

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onError?.({}, {}, {});

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("shows server error toast when not a contract error", () => {
      let onError: ((error: unknown) => void) | undefined;
      mockGetContractError.mockReturnValue(undefined);

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onError?.({ status: 500 });

      expect(mockToast).toHaveBeenCalledWith({
        description: "common.errors.serverError",
        variant: "destructive",
      });
    });

    it("shows nameAlreadyExists for 409 contract error", () => {
      let onError: ((error: unknown) => void) | undefined;
      const contractError = { status: 409, body: {}, headers: new Headers() };
      mockGetContractError.mockReturnValue(contractError as never);

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onError?.(contractError);

      expect(mockToast).toHaveBeenCalledWith({
        description: "protocols.nameAlreadyExists",
        variant: "destructive",
      });
    });

    it("shows createError for other contract error statuses", () => {
      let onError: ((error: unknown) => void) | undefined;
      const contractError = { status: 422, body: {}, headers: new Headers() };
      mockGetContractError.mockReturnValue(contractError as never);

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      onError?.(contractError);

      expect(mockToast).toHaveBeenCalledWith({
        description: "protocols.createError",
        variant: "destructive",
      });
    });

    it("calls options.onError with contract error", () => {
      let onError: ((e: unknown, v: unknown, c: unknown, m: unknown) => void) | undefined;
      const mockOnError = vi.fn();
      const contractError = { status: 409, body: {}, headers: new Headers() };
      mockGetContractError.mockReturnValue(contractError as never);

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      renderHook(() => useProtocolCreate({ onError: mockOnError }), { wrapper: createWrapper() });

      const variables = { body: {} };
      const context = {};
      const mutation = {};
      onError?.(contractError, variables, context, mutation);

      expect(mockOnError).toHaveBeenCalledWith(contractError, variables, context, mutation);
    });

    it("should not call onError option when error is not a contract error", () => {
      let onError: ((error: unknown) => void) | undefined;
      const mockOnError = vi.fn();

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onError: typeof onError }) => {
          onError = opts.onError;
          return {};
        },
      );

      mockGetContractError.mockReturnValue(undefined);

      renderHook(() => useProtocolCreate({ onError: mockOnError }), { wrapper: createWrapper() });

      onError?.(new Error("non-contract error"));

      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("onSettled", () => {
    it("invalidates protocols and calls onSettled option", async () => {
      let onSettled: (() => Promise<void>) | undefined;
      const mockOnSettled = vi.fn();

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onSettled: () => Promise<void> }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useProtocolCreate({ onSettled: mockOnSettled }), {
        wrapper: createWrapper(),
      });

      await onSettled?.();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["protocols"] });
      expect(mockOnSettled).toHaveBeenCalled();
    });

    it("works when onSettled option is omitted", async () => {
      let onSettled: (() => Promise<void>) | undefined;

      (mockTsr.protocols.createProtocol.useMutation as unknown) = vi.fn(
        (opts: { onSettled: () => Promise<void> }) => {
          onSettled = opts.onSettled;
          return {};
        },
      );

      renderHook(() => useProtocolCreate(), { wrapper: createWrapper() });

      await onSettled?.();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["protocols"] });
    });
  });

  it("should return the result of tsr mutation", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    };

    (mockTsr.protocols.createProtocol.useMutation as unknown) = vi
      .fn()
      .mockReturnValue(mockMutationResult);

    const { result } = renderHook(() => useProtocolCreate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutationResult);
  });
});
