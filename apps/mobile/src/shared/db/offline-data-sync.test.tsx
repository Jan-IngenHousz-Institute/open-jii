import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineDataSync, useOfflineDataSync } from "./offline-data-sync";

const { prefetchOfflineData, useSession, appStateHandler } = vi.hoisted(() => ({
  prefetchOfflineData: vi.fn(),
  useSession: vi.fn(),
  appStateHandler: { current: undefined as undefined | ((s: string) => void) },
}));

vi.mock("~/shared/db/prefetch-offline-data", () => ({
  prefetchOfflineData: (...a: unknown[]) => prefetchOfflineData(...a),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => useSession() }));
vi.mock("~/shared/ui/hooks/use-app-state", () => ({
  useAppState: (h: (s: string) => void) => {
    appStateHandler.current = h;
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  onlineManager.setOnline(true);
  useSession.mockReturnValue({ user: { id: "user-1" } });
});

describe("useOfflineDataSync", () => {
  it("re-prefetches (throttled) when connectivity returns", () => {
    renderHook(() => useOfflineDataSync(), { wrapper });

    onlineManager.setOnline(false);
    expect(prefetchOfflineData).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
  });

  it("re-prefetches when the app returns to the foreground while online", () => {
    renderHook(() => useOfflineDataSync(), { wrapper });

    appStateHandler.current?.("active");
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
  });

  it("does nothing when signed out", () => {
    useSession.mockReturnValue({ user: undefined });
    renderHook(() => useOfflineDataSync(), { wrapper });

    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    appStateHandler.current?.("active");

    expect(prefetchOfflineData).not.toHaveBeenCalled();
  });
});

describe("OfflineDataSync", () => {
  it("mounts the sync hook as a render-free service", () => {
    const { toJSON } = render(React.createElement(OfflineDataSync), { wrapper });

    expect(toJSON()).toBeNull();
    // The mounted hook wired up the foreground trigger.
    appStateHandler.current?.("active");
    expect(prefetchOfflineData).toHaveBeenCalledWith(expect.anything(), "user-1", {
      throttle: true,
    });
  });
});
