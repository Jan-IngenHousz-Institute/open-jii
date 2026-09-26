import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExperiments } from "./use-experiments";

const { mockListExperiments, capturedOptions } = vi.hoisted(() => ({
  mockListExperiments: vi.fn(),
  capturedOptions: [] as Record<string, unknown>[],
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: {
        queryOptions: ({ input, ...opts }: { input: unknown }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["experiments", "listExperiments", input],
            queryFn: () => mockListExperiments(input),
            ...opts,
          };
        },
      },
    },
  },
}));

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    name: "Canopy Phi2 Sweep",
    description: "<p>Phi2 across the canopy profile</p>",
    membershipStatus: "member",
    ...overrides,
  };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions.length = 0;
  onlineManager.setOnline(true);
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockListExperiments.mockResolvedValue([row()]);
});

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
});

describe("useExperiments", () => {
  it("asks for the related slice", async () => {
    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(mockListExperiments).toHaveBeenCalledWith({ scope: "related" });
  });

  it("keeps the formatted picker options its existing callers read", async () => {
    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.experiments).toHaveLength(1));
    expect(result.current.experiments[0]).toEqual({
      value: "exp-1",
      label: "Canopy Phi2 Sweep",
      description: "Phi2 across the canopy profile",
      fullDescription: "<p>Phi2 across the canopy profile</p>",
    });
  });

  it("leaves a description-less experiment's description undefined", async () => {
    mockListExperiments.mockResolvedValue([row({ description: null })]);

    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.experiments).toHaveLength(1));
    expect(result.current.experiments[0]?.description).toBeUndefined();
  });

  it("exposes the raw rows alongside the options, membership status intact", async () => {
    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(result.current.rows).toEqual([row()]);
  });

  it("reads the rows out of a paginated envelope too", async () => {
    mockListExperiments.mockResolvedValue({
      items: [row()],
      page: 1,
      pageSize: 20,
      totalPages: 1,
      totalCount: 1,
    });

    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(result.current.rows).toEqual([row()]);
  });

  it("reports an empty response as an empty array, not as no response", async () => {
    mockListExperiments.mockResolvedValue([]);

    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.rows).toEqual([]));
    expect(result.current.rows).not.toBeUndefined();
    expect(result.current.experiments).toEqual([]);
  });

  it("leaves rows undefined and reports isPaused on a cold offline load", async () => {
    onlineManager.setOnline(false);
    mockListExperiments.mockRejectedValue(new Error("Network request failed"));

    const { result } = renderHook(() => useExperiments(), { wrapper });

    await waitFor(() => expect(result.current.isPaused).toBe(true));
    // The distinction the picker prompt and the Home card both hang on:
    // nothing came back, which is not the same as an empty list.
    expect(result.current.rows).toBeUndefined();
    expect(result.current.experiments).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("refetches on mount and on foreground so a redeemed experiment shows up", () => {
    renderHook(() => useExperiments(), { wrapper });

    expect(capturedOptions[0]?.refetchOnMount).toBe(true);
    expect(capturedOptions[0]?.refetchOnWindowFocus).toBe(true);
    expect(capturedOptions[0]?.networkMode).toBe("offlineFirst");
  });
});
