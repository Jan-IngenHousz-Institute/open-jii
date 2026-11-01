import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineDataSync, useOfflineDataSync } from "./offline-data-sync";

const { ensureDeviceRegistered, prefetchOfflineData, useSession, appStateHandler } = vi.hoisted(
  () => ({
    prefetchOfflineData: vi.fn<() => Promise<void>>(),
    ensureDeviceRegistered: vi.fn<() => Promise<void>>(),
    useSession: vi.fn(),
    appStateHandler: { current: undefined as undefined | ((s: string) => void) },
  }),
);

vi.mock("~/shared/composition/prefetch-offline-data", () => ({ prefetchOfflineData }));
vi.mock("~/shared/composition/ensure-device-registered", () => ({ ensureDeviceRegistered }));
vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => useSession() }));
vi.mock("~/shared/ui/hooks/use-app-state", () => ({
  useAppState: (h: (s: string) => void) => {
    appStateHandler.current = h;
  },
}));

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  prefetchOfflineData.mockResolvedValue(undefined);
  ensureDeviceRegistered.mockResolvedValue(undefined);
  onlineManager.setOnline(true);
  useSession.mockReturnValue({ user: { id: "user-1" } });
});

function settleSyncWork() {
  return Promise.all([
    ...prefetchOfflineData.mock.results.map(({ value }) => value),
    ...ensureDeviceRegistered.mock.results.map(({ value }) => value),
  ]);
}

afterEach(async () => {
  cleanup();
  appStateHandler.current = undefined;
  // Both fire-and-forget services must settle before this worker is torn down.
  await settleSyncWork();
  await client.cancelQueries();
  client.clear();
  vi.restoreAllMocks();
});

describe("useOfflineDataSync", () => {
  it("re-prefetches (throttled) when connectivity returns", async () => {
    renderHook(() => useOfflineDataSync(), { wrapper });

    onlineManager.setOnline(false);
    expect(prefetchOfflineData).not.toHaveBeenCalled();

    await act(async () => {
      onlineManager.setOnline(true);
      await settleSyncWork();
    });
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
    expect(ensureDeviceRegistered).toHaveBeenCalledExactlyOnceWith({ throttle: true });
  });

  it("re-prefetches when the app returns to the foreground while online", async () => {
    renderHook(() => useOfflineDataSync(), { wrapper });

    await act(async () => {
      appStateHandler.current?.("active");
      await settleSyncWork();
    });
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
    expect(ensureDeviceRegistered).toHaveBeenCalledExactlyOnceWith({ throttle: true });
  });

  it("does nothing when signed out", async () => {
    useSession.mockReturnValue({ user: undefined });
    renderHook(() => useOfflineDataSync(), { wrapper });

    onlineManager.setOnline(false);
    await act(async () => {
      onlineManager.setOnline(true);
      await settleSyncWork();
    });
    await act(async () => {
      appStateHandler.current?.("active");
      await settleSyncWork();
    });

    expect(prefetchOfflineData).not.toHaveBeenCalled();
    expect(ensureDeviceRegistered).not.toHaveBeenCalled();
  });
  it("unsubscribes connectivity work when unmounted", async () => {
    const { unmount } = renderHook(() => useOfflineDataSync(), { wrapper });
    unmount();
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await settleSyncWork();
    });
    expect(prefetchOfflineData).not.toHaveBeenCalled();
    expect(ensureDeviceRegistered).not.toHaveBeenCalled();
  });
});

describe("OfflineDataSync", () => {
  it("mounts the sync hook as a render-free service", async () => {
    const { toJSON } = render(React.createElement(OfflineDataSync), { wrapper });

    expect(toJSON()).toBeNull();
    // The mounted hook wired up the foreground trigger.
    await act(async () => {
      appStateHandler.current?.("active");
      await settleSyncWork();
    });
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
    expect(ensureDeviceRegistered).toHaveBeenCalledExactlyOnceWith({ throttle: true });
  });
});
