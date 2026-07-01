// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { useForceUpdateGate } from "./use-force-update-gate";

const {
  foregroundListeners,
  mockEnvLoaded,
  mockFetchForceUpdate,
  mockIsRestoring,
  mockNativeVersion,
} = vi.hoisted(() => ({
  foregroundListeners: new Set<() => void>(),
  mockEnvLoaded: { value: true },
  mockFetchForceUpdate: vi.fn(),
  mockIsRestoring: { value: false },
  mockNativeVersion: { value: "1.0.0" as string | null },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useIsRestoring: () => mockIsRestoring.value,
  };
});

vi.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return mockNativeVersion.value;
  },
}));

vi.mock("~/features/force-update/services/fetch-force-update", () => ({
  fetchForceUpdate: (...args: unknown[]) => mockFetchForceUpdate(...args),
}));

vi.mock("~/shared/stores/environment-store", () => ({
  useEnvironmentStore: (selector: (state: { isLoaded: boolean }) => unknown) =>
    selector({ isLoaded: mockEnvLoaded.value }),
}));

vi.mock("~/shared/device/app-lifecycle", () => ({
  onAppForeground: (listener: () => void) => {
    foregroundListeners.add(listener);
    return () => foregroundListeners.delete(listener);
  },
}));

const QUERY_KEY = ["contentful", "force-update", "en-US"] as const;
const STALE_UPDATED_AT = Date.now() - 10 * 60 * 1_000;

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeGate(
  overrides: Partial<PageForceUpdateFieldsFragment> = {},
): PageForceUpdateFieldsFragment {
  return {
    __typename: "PageForceUpdate",
    sys: { __typename: "Sys", id: "force-update-1" },
    internalName: "force-update",
    title: "Please update",
    body: null,
    updateCta: null,
    minVersion: "2.0.0",
    effectiveAt: new Date(Date.now() - 1_000).toISOString(),
    active: true,
    ...overrides,
  };
}

function setCachedGate(gate: PageForceUpdateFieldsFragment | null, updatedAt = Date.now()) {
  queryClient.setQueryData(QUERY_KEY, gate, { updatedAt });
}

function pendingFetch() {
  let resolve!: (value: PageForceUpdateFieldsFragment | null) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<PageForceUpdateFieldsFragment | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  mockFetchForceUpdate.mockReturnValueOnce(promise);
  return { promise, resolve, reject };
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  mockEnvLoaded.value = true;
  mockIsRestoring.value = false;
  mockNativeVersion.value = "1.0.0";
  mockFetchForceUpdate.mockReset();
  foregroundListeners.clear();
});

describe("useForceUpdateGate", () => {
  it("uses a fresh cached gated decision without refetching", async () => {
    setCachedGate(makeGate());

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("gated"));
    expect(result.current.gated).toBe(true);
    expect(mockFetchForceUpdate).not.toHaveBeenCalled();
  });

  it("uses a fresh cached allowed decision without refetching", async () => {
    mockNativeVersion.value = "2.0.0";
    setCachedGate(makeGate());

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("allowed"));
    expect(result.current.gated).toBe(false);
    expect(mockFetchForceUpdate).not.toHaveBeenCalled();
  });

  it("keeps checking for stale cached allowed data until fresh data gates", async () => {
    setCachedGate(makeGate({ minVersion: "1.0.0" }), STALE_UPDATED_AT);
    const fetch = pendingFetch();

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(mockFetchForceUpdate).toHaveBeenCalledWith("en-US"));
    expect(result.current.status).toBe("checking");

    fetch.resolve(makeGate({ minVersion: "2.0.0" }));

    await waitFor(() => expect(result.current.status).toBe("gated"));
  });

  it("keeps checking for stale cached gated data until fresh data allows", async () => {
    setCachedGate(makeGate({ minVersion: "2.0.0" }), STALE_UPDATED_AT);
    const fetch = pendingFetch();

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(mockFetchForceUpdate).toHaveBeenCalledWith("en-US"));
    expect(result.current.status).toBe("checking");

    fetch.resolve(makeGate({ minVersion: "1.0.0" }));

    await waitFor(() => expect(result.current.status).toBe("allowed"));
  });

  it("stays checking while the persisted query cache is restoring", async () => {
    mockIsRestoring.value = true;
    setCachedGate(makeGate());
    mockFetchForceUpdate.mockResolvedValue(null);

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("checking"));
  });

  it("falls back to a cached gate when a stale refetch fails", async () => {
    setCachedGate(makeGate(), STALE_UPDATED_AT);
    mockFetchForceUpdate.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("gated"));
    expect(result.current.gate?.sys.id).toBe("force-update-1");
  });

  it("allows the app when there is no cached gate and the startup fetch fails", async () => {
    mockFetchForceUpdate.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("allowed"));
    expect(result.current.gate).toBeNull();
  });

  it("re-evaluates a cached gate against the updated native app version", async () => {
    mockNativeVersion.value = "2.0.0";
    setCachedGate(makeGate({ minVersion: "2.0.0" }));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("allowed"));
    expect(mockFetchForceUpdate).not.toHaveBeenCalled();
  });

  it("does not fetch on foreground while cached data is still fresh", async () => {
    setCachedGate(makeGate({ minVersion: "1.0.0" }));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("allowed"));

    for (const listener of Array.from(foregroundListeners)) listener();

    expect(result.current.status).toBe("allowed");
    expect(mockFetchForceUpdate).not.toHaveBeenCalled();
  });

  it("fetches stale cached data on foreground without returning to checking", async () => {
    setCachedGate(makeGate({ minVersion: "1.0.0" }));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("allowed"));

    setCachedGate(makeGate({ minVersion: "1.0.0" }), STALE_UPDATED_AT);
    const fetch = pendingFetch();
    for (const listener of Array.from(foregroundListeners)) listener();

    await waitFor(() => expect(mockFetchForceUpdate).toHaveBeenCalledWith("en-US"));
    expect(result.current.status).toBe("allowed");

    fetch.resolve(makeGate({ minVersion: "2.0.0" }));
    await waitFor(() => expect(result.current.status).toBe("gated"));
  });

  it("does not gate when the native version is unavailable", async () => {
    mockNativeVersion.value = null;
    setCachedGate(makeGate({ minVersion: "1.0.0" }));

    const { result } = renderHook(() => useForceUpdateGate(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("allowed"));
    expect(result.current.gated).toBe(false);
  });
});
