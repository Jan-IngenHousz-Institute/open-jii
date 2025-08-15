import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { ExperimentProtocol } from "@repo/api";

import { useExperimentProtocolAdd } from "./useExperimentProtocolAdd";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      addExperimentProtocols: {
        useMutation: vi.fn(),
      },
    },
  },
}));

interface MutateVariables {
  params: { id: string };
  body: { protocols: { protocolId: string; order?: number }[] };
}

const mockTsr = tsr;

describe("useExperimentProtocolAdd", () => {
  it("should optimistically update cache in onMutate", async () => {
    const setQueryData = vi.fn();
    const previousProtocols = { body: [{ protocolId: "protocol-1", order: 0 }] };
    const cancelQueries = vi.fn();
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => previousProtocols),
      setQueryData,
      cancelQueries,
      invalidateQueries: vi.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    let onMutate:
      | ((variables: MutateVariables) => Promise<{ previousProtocols: typeof previousProtocols }>)
      | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(
      (opts: {
        onMutate: (
          variables: MutateVariables,
        ) => Promise<{ previousProtocols: typeof previousProtocols }>;
      }) => {
        onMutate = opts.onMutate;
        return {
          mutateAsync: vi.fn(),
          isPending: false,
          isError: false,
          isSuccess: false,
          error: null,
          data: null,
        };
      },
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    // Simulate onMutate
    await onMutate?.({
      params: { id: "experiment-1" },
      body: { protocols: [{ protocolId: "protocol-2" }] },
    });
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-protocols", "experiment-1"],
    });
    expect(setQueryData).toHaveBeenCalledWith(
      ["experiment-protocols", "experiment-1"],
      expect.objectContaining({
        body: expect.arrayContaining([
          expect.objectContaining({
            protocol: expect.objectContaining({ id: "protocol-2" }) as Partial<ExperimentProtocol>,
          }),
        ]) as Partial<ExperimentProtocol>,
      }),
    );
  });
  it("should call addProtocols without throwing", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    await expect(
      result.current.addProtocols([{ protocolId: "protocol-1" }]),
    ).resolves.not.toThrow();
  });

  it("should expose addProtocols and mutation state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    expect(typeof result.current.addProtocols).toBe("function");
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("should call mutateAsync with correct params", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    const protocols = [{ protocolId: "protocol-1" }];
    await result.current.addProtocols(protocols);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      params: { id: "experiment-1" },
      body: { protocols: [{ protocolId: "protocol-1", order: 0 }] },
    });
  });

  it("should increment order based on existing protocols in cache", async () => {
    // Mock getQueryData to return existing protocols with order 0 and 1
    const existingProtocols = {
      body: [
        { protocolId: "protocol-1", order: 0 },
        { protocolId: "protocol-2", order: 1 },
      ],
    };
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => existingProtocols),
      setQueryData: vi.fn(),
      cancelQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    const protocols = [{ protocolId: "protocol-3" }];
    await result.current.addProtocols(protocols);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      params: { id: "experiment-1" },
      body: { protocols: [{ protocolId: "protocol-3", order: 2 }] },
    });
  });

  it("should assign order 0 if no protocols exist in cache", async () => {
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => undefined),
      setQueryData: vi.fn(),
      cancelQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
    }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    await result.current.addProtocols([{ protocolId: "protocol-1" }]);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      params: { id: "experiment-1" },
      body: { protocols: [{ protocolId: "protocol-1", order: 0 }] },
    });
  });

  it("should optimistically update cache and rollback on error", () => {
    const setQueryData = vi.fn();
    const previousProtocols = { body: [] };
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => previousProtocols),
      setQueryData,
      cancelQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onError: ((err: Error, variables: any, context: any) => void) | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(
      (opts: { onError: (err: Error, variables: unknown, context: unknown) => void }) => {
        onError = opts.onError;
        return {
          mutateAsync: mutateAsyncMock,
          isPending: false,
          isError: false,
          isSuccess: false,
          error: null,
          data: null,
        };
      },
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    // Simulate error and rollback
    onError?.(new Error("fail"), {}, { previousProtocols });
    expect(setQueryData).toHaveBeenCalledWith(
      ["experiment-protocols", "experiment-1"],
      previousProtocols,
    );
  });

  it("should invalidate queries onSettled", async () => {
    const invalidateQueries = vi.fn();
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => undefined),
      setQueryData: vi.fn(),
      cancelQueries: vi.fn(),
      invalidateQueries,
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    let onSettled: (() => Promise<void>) | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(
      (opts: { onSettled: () => Promise<void> }) => {
        onSettled = opts.onSettled;
        return {
          mutateAsync: vi.fn(),
          isPending: false,
          isError: false,
          isSuccess: false,
          error: null,
          data: null,
        };
      },
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    renderHook(() => useExperimentProtocolAdd("experiment-1"), { wrapper });
    // Simulate onSettled
    await onSettled?.();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-protocols", "experiment-1"],
    });
  });
  let mutateAsyncMock: vi.Mock;
  beforeEach(() => {
    mutateAsyncMock = vi.fn().mockResolvedValue({});
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: vi.fn(() => undefined),
      setQueryData: vi.fn(),
      cancelQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
    }));
  });
});
