import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoginConnection } from "./use-login-connection";

const { probe } = vi.hoisted(() => ({ probe: vi.fn<() => Promise<boolean>>() }));

vi.mock("~/shared/device/is-online", () => ({ isOnline: probe }));

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  probe.mockReset();
});

afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
});

describe("useLoginConnection", () => {
  it("waits for two consecutive missed probes before reporting unreachable", async () => {
    let finishConfirmation!: (online: boolean) => void;
    probe.mockResolvedValueOnce(false).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishConfirmation = resolve;
        }),
    );

    const { result } = renderHook(
      () => {
        const { data, isFetching, refetch } = useLoginConnection();
        return { data, isFetching, refetch };
      },
      { wrapper },
    );

    await waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(true);

    act(() => finishConfirmation(false));
    await waitFor(() => expect(result.current.data).toBe(false));
  });

  it("does not report a slow connection as unreachable after one missed probe", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(
      () => {
        const { data, isFetching, refetch } = useLoginConnection();
        return { data, isFetching, refetch };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBe(true));

    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toBe(true);
    expect(probe).toHaveBeenCalledTimes(4);
  });

  it("retries immediately even when the global online manager is offline", async () => {
    onlineManager.setOnline(false);
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    const { result } = renderHook(
      () => {
        const { data, isFetching, refetch } = useLoginConnection();
        return { data, isFetching, refetch };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toBe(false));

    let finishRetry!: (online: boolean) => void;
    probe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve;
        }),
    );
    act(() => {
      void result.current.refetch({ cancelRefetch: false });
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(probe).toHaveBeenCalledTimes(3);
    expect(result.current.data).toBe(false);

    act(() => finishRetry(true));
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(result.current.isFetching).toBe(false);
  });

  it("recovers automatically on the next poll after one successful probe", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
    const { result } = renderHook(
      () => {
        const { data, isFetching, refetch } = useLoginConnection();
        return { data, isFetching, refetch };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toBe(false));

    await waitFor(() => expect(result.current.data).toBe(true), { timeout: 3000 });
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
