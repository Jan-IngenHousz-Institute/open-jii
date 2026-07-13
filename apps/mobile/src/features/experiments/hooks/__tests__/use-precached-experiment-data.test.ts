// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrecachedExperimentData } from "../use-precached-experiment-data";

const { mockListExperiments, mockGetWorkbookVersion } = vi.hoisted(() => ({
  mockListExperiments: vi.fn(),
  mockGetWorkbookVersion: vi.fn(),
}));

vi.mock("~/shared/api/tsr", () => ({
  tsr: {
    experiments: { listExperiments: { query: (...a: unknown[]) => mockListExperiments(...a) } },
    workbooks: { getWorkbookVersion: { query: (...a: unknown[]) => mockGetWorkbookVersion(...a) } },
  },
}));

const REF = { id: "exp-1", workbookId: "wb-1", workbookVersionId: "wv-1" };

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockListExperiments.mockResolvedValue({ body: [REF] });
  mockGetWorkbookVersion.mockImplementation(({ params }: any) =>
    Promise.resolve({ body: { id: params.versionId, cells: [], entitySnapshots: {} } }),
  );
});

afterEach(() => {
  queryClient.clear();
});

describe("usePrecachedExperimentData", () => {
  it("caches the workbook version when the experiments list is already cached", async () => {
    queryClient.setQueryData(["experiments"], { body: [REF] });

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.workbookVersionId).toBe("wv-1");
    expect(queryClient.getQueryData(["workbook-version", "wb-1", "wv-1"])).toBeDefined();
    // No separate command/macro fetches: the workbook version carries them.
    expect(mockListExperiments).not.toHaveBeenCalled();
  });

  it("fetches the experiments list to resolve the ref when it isn't cached", async () => {
    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListExperiments).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["workbook-version", "wb-1", "wv-1"])).toBeDefined();
  });

  it("ends in an error state when the workbook version fetch fails", async () => {
    queryClient.setQueryData(["experiments"], { body: [REF] });
    mockGetWorkbookVersion.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(["precache-experiment-data", "exp-1"])).toBeUndefined();
  });

  it("recovers on refetch once the version fetch succeeds (reconnect path)", async () => {
    queryClient.setQueryData(["experiments"], { body: [REF] });
    mockGetWorkbookVersion.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["workbook-version", "wb-1", "wv-1"])).toBeDefined();
  });

  it("errors when the experiment has no workbook version", async () => {
    queryClient.setQueryData(["experiments"], {
      body: [{ id: "exp-1", workbookId: null, workbookVersionId: null }],
    });

    const { result } = renderHook(() => usePrecachedExperimentData("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetWorkbookVersion).not.toHaveBeenCalled();
  });
});
