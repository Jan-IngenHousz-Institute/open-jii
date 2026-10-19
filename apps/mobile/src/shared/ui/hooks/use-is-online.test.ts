import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "~/shared/testing/deferred";

import { useIsOnline } from "./use-is-online";

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

describe("useIsOnline({ confirm: true })", () => {
  // Read every field during render so TanStack's tracked props notify on each change.
  const renderConfirmed = () =>
    renderHook(
      () => {
        const { data, isFetching, refetch } = useIsOnline({ confirm: true });
        return { data, isFetching, refetch };
      },
      { wrapper },
    );

  it("waits for two consecutive missed probes before reporting unreachable", async () => {
    const confirmation = deferred<boolean>();
    probe.mockResolvedValueOnce(false).mockReturnValueOnce(confirmation.promise);
    const { result } = renderConfirmed();

    await waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(true);

    act(() => confirmation.resolve(false));
    await waitFor(() => expect(result.current.data).toBe(false));
  });

  it("does not report a slow connection as unreachable after one missed probe", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderConfirmed();

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
    const { result } = renderConfirmed();
    await waitFor(() => expect(result.current.data).toBe(false));

    const retry = deferred<boolean>();
    probe.mockReturnValueOnce(retry.promise);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(probe).toHaveBeenCalledTimes(3);
    expect(result.current.data).toBe(false);

    act(() => retry.resolve(true));
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(result.current.isFetching).toBe(false);
  });

  it("recovers automatically on the next poll after one successful probe", async () => {
    vi.useFakeTimers();
    try {
      probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
      const { result } = renderConfirmed();
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current.data).toBe(false);

      await act(() => vi.advanceTimersByTimeAsync(1999));
      expect(probe).toHaveBeenCalledTimes(2);
      await act(() => vi.advanceTimersByTimeAsync(1));
      await vi.waitFor(() => expect(result.current.data).toBe(true));
      expect(probe).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useIsOnline()", () => {
  it("keeps reporting offline after a single missed probe", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValue(true);
    const { result } = renderHook(() => useIsOnline(), { wrapper });

    await waitFor(() => expect(result.current.data).toBe(false));
    expect(probe).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().find({ queryKey: ["is-online"], exact: true })).toBeDefined();
  });
});
