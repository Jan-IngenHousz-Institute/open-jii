// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrecachedExperimentData } from "../use-precached-experiment-data";

const { mockGetFlow, mockGetProtocol, mockGetMacro } = vi.hoisted(() => ({
  mockGetFlow: vi.fn(),
  mockGetProtocol: vi.fn(),
  mockGetMacro: vi.fn(),
}));

vi.mock("~/shared/api/tsr", () => ({
  tsr: {
    experiments: { getFlow: { query: (...a: unknown[]) => mockGetFlow(...a) } },
    protocols: { getProtocol: { query: (...a: unknown[]) => mockGetProtocol(...a) } },
    macros: { getMacro: { query: (...a: unknown[]) => mockGetMacro(...a) } },
  },
}));

function flowWith(protocolIds: string[], macroIds: string[] = []) {
  return {
    body: {
      graph: {
        nodes: [
          ...protocolIds.map((id) => ({ type: "measurement", content: { protocolId: id } })),
          ...macroIds.map((id) => ({ type: "analysis", content: { macroId: id } })),
        ],
      },
    },
  };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGetProtocol.mockImplementation(({ params }: any) =>
    Promise.resolve({ body: { id: params.id, name: `protocol ${params.id}` } }),
  );
  mockGetMacro.mockImplementation(({ params }: any) =>
    Promise.resolve({ body: { id: params.id } }),
  );
});

afterEach(() => {
  queryClient.clear();
});

describe("usePrecachedExperimentData", () => {
  it("succeeds and caches every protocol when all fetches resolve", async () => {
    mockGetFlow.mockResolvedValue(flowWith(["proto-1", "proto-2"], ["macro-1"]));

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.protocolIds).toEqual(["proto-1", "proto-2"]);
    expect(queryClient.getQueryData(["protocol", "proto-1"])).toEqual({
      body: { id: "proto-1", name: "protocol proto-1" },
    });
    expect(queryClient.getQueryData(["protocol", "proto-2"])).toBeDefined();
  });

  it("ends in an error state when any protocol fetch fails", async () => {
    mockGetFlow.mockResolvedValue(flowWith(["proto-1", "proto-2"]));
    mockGetProtocol.mockImplementation(({ params }: any) =>
      params.id === "proto-2"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({ body: { id: params.id } }),
    );

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(["precache-experiment-data", "exp-1"])).toBeUndefined();
  });

  it("recovers on refetch once the failing fetch succeeds (reconnect path)", async () => {
    mockGetFlow.mockResolvedValue(flowWith(["proto-1", "proto-2"]));
    mockGetProtocol.mockImplementation(({ params }: any) =>
      params.id === "proto-2"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({ body: { id: params.id } }),
    );

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Simulate connectivity returning: the previously-failing fetch now resolves.
    mockGetProtocol.mockImplementation(({ params }: any) =>
      Promise.resolve({ body: { id: params.id } }),
    );
    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["protocol", "proto-2"])).toBeDefined();
  });

  it("deduplicates repeated protocol ids before fetching", async () => {
    mockGetFlow.mockResolvedValue(flowWith(["proto-1", "proto-1", "proto-1"]));

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.protocolIds).toEqual(["proto-1"]);
    expect(mockGetProtocol).toHaveBeenCalledTimes(1);
  });
});
