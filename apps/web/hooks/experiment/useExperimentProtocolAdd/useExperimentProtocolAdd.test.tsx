import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";

import type { ExperimentProtocol } from "@repo/api";

import { useExperimentProtocolAdd } from "./useExperimentProtocolAdd";

jest.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: jest.fn(),
    experiments: {
      addExperimentProtocols: {
        useMutation: jest.fn(),
      },
    },
  },
}));

interface MutateVariables {
  params: { id: string };
  body: { protocols: { protocolId: string; order?: number }[] };
}

const mockTsr = tsr as jest.Mocked<typeof tsr>;

describe("useExperimentProtocolAdd", () => {
  it("should optimistically update cache in onMutate", async () => {
    const setQueryData = jest.fn();
    const previousProtocols = { body: [{ protocolId: "protocol-1", order: 0 }] };
    const cancelQueries = jest.fn();
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: jest.fn(() => previousProtocols),
      setQueryData,
      cancelQueries,
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    let onMutate:
      | ((variables: MutateVariables) => Promise<{ previousProtocols: typeof previousProtocols }>)
      | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(
      (opts: {
        onMutate: (
          variables: MutateVariables,
        ) => Promise<{ previousProtocols: typeof previousProtocols }>;
      }) => {
        onMutate = opts.onMutate;
        return {
          mutateAsync: jest.fn(),
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
      getQueryData: jest.fn(() => existingProtocols),
      setQueryData: jest.fn(),
      cancelQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(() => ({
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
      getQueryData: jest.fn(() => undefined),
      setQueryData: jest.fn(),
      cancelQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(() => ({
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
    const setQueryData = jest.fn();
    const previousProtocols = { body: [] };
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: jest.fn(() => previousProtocols),
      setQueryData,
      cancelQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onError: ((err: Error, variables: any, context: any) => void) | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(
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
    const invalidateQueries = jest.fn();
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: jest.fn(() => undefined),
      setQueryData: jest.fn(),
      cancelQueries: jest.fn(),
      invalidateQueries,
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    let onSettled: (() => Promise<void>) | undefined;
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(
      (opts: { onSettled: () => Promise<void> }) => {
        onSettled = opts.onSettled;
        return {
          mutateAsync: jest.fn(),
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
  let mutateAsyncMock: jest.Mock;
  beforeEach(() => {
    mutateAsyncMock = jest.fn().mockResolvedValue({});
    mockTsr.useQueryClient.mockReturnValue({
      getQueryData: jest.fn(() => undefined),
      setQueryData: jest.fn(),
      cancelQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof tsr.useQueryClient>);
    (mockTsr.experiments.addExperimentProtocols.useMutation as unknown) = jest.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
    }));
  });
});
