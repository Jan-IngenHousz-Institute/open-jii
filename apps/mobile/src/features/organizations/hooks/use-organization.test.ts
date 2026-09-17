import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOrganization } from "./use-organization";

const { mockGetOrganization, capturedOptions } = vi.hoisted(() => ({
  mockGetOrganization: vi.fn(),
  capturedOptions: [] as Record<string, unknown>[],
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    organizations: {
      getOrganization: {
        queryOptions: ({ input, ...opts }: { input: { id: string } }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["organization", input.id],
            queryFn: () => mockGetOrganization(input),
            ...opts,
          };
        },
      },
    },
  },
}));

/** An oRPC client error carries the HTTP status the retry predicate reads. */
function apiError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status });
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockGetOrganization.mockResolvedValue({ id: "org-1", name: "Photosynthesis Lab" });
});

afterEach(() => {
  queryClient.clear();
});

describe("useOrganization", () => {
  it("fetches by id and returns the profile", async () => {
    const { result } = renderHook(() => useOrganization("org-1"), { wrapper });

    await waitFor(() => expect(result.current.organization).toBeDefined());
    expect(mockGetOrganization).toHaveBeenCalledWith({ id: "org-1" });
  });

  it("reports isPaused so the screen can tell offline from loading", async () => {
    const { result } = renderHook(() => useOrganization("org-1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPaused).toBe(false);
  });

  it("does not fetch without an id", () => {
    renderHook(() => useOrganization(undefined), { wrapper });

    expect(mockGetOrganization).not.toHaveBeenCalled();
    expect(capturedOptions[0]?.enabled).toBe(false);
  });

  it("suppresses the global toast: the screen renders the unavailable state itself", () => {
    renderHook(() => useOrganization("org-1"), { wrapper });

    expect(capturedOptions[0]?.meta).toEqual({ suppressToast: true });
  });

  it("does not retry a 404 — private and deleted are answers, not failures", async () => {
    mockGetOrganization.mockRejectedValue(apiError(404));

    const { result } = renderHook(() => useOrganization("org-1"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(mockGetOrganization).toHaveBeenCalledTimes(1);
  });

  it("refetches on mount and on foreground, so an approval elsewhere lands here", () => {
    renderHook(() => useOrganization("org-1"), { wrapper });

    expect(capturedOptions[0]?.refetchOnMount).toBe(true);
    expect(capturedOptions[0]?.refetchOnWindowFocus).toBe(true);
  });

  it("reports isNotFound for a 404 even when a profile is already cached", async () => {
    const { result, rerender } = renderHook(() => useOrganization("org-1"), { wrapper });
    await waitFor(() => expect(result.current.organization).toBeDefined());

    mockGetOrganization.mockRejectedValue(apiError(404));
    await result.current.refetch();
    rerender();

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.organization).toBeDefined();
  });

  it("does not report isNotFound for a network failure with cached data", async () => {
    const { result, rerender } = renderHook(() => useOrganization("org-1"), { wrapper });
    await waitFor(() => expect(result.current.organization).toBeDefined());

    mockGetOrganization.mockRejectedValue(new Error("Network request failed"));
    await result.current.refetch();
    rerender();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.organization).toBeDefined();
  });

  it("retries other errors", async () => {
    mockGetOrganization.mockRejectedValue(apiError(500));

    const { result } = renderHook(() => useOrganization("org-1"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(mockGetOrganization).toHaveBeenCalledTimes(4);
  });
});
