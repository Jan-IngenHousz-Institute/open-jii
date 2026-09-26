import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMyExperimentJoinRequest } from "./use-my-experiment-join-request";

const { mockGetMyJoinRequest, capturedOptions } = vi.hoisted(() => ({
  mockGetMyJoinRequest: vi.fn(),
  capturedOptions: [] as Record<string, unknown>[],
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      getMyJoinRequest: {
        queryOptions: ({ input, ...opts }: { input: { id: string } }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["my-join-request", input.id],
            queryFn: () => mockGetMyJoinRequest(input),
            ...opts,
          };
        },
      },
    },
  },
}));

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
  mockGetMyJoinRequest.mockResolvedValue({ id: "req-1", status: "pending" });
});

afterEach(() => {
  queryClient.clear();
});

describe("useMyExperimentJoinRequest", () => {
  it("exposes the request id that cancelling needs", async () => {
    const { result } = renderHook(() => useMyExperimentJoinRequest("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.requestId).toBe("req-1"));
    expect(mockGetMyJoinRequest).toHaveBeenCalledWith({ id: "exp-1" });
  });

  it("stays disabled unless the caller says the experiment is pending", () => {
    renderHook(() => useMyExperimentJoinRequest("exp-1", { enabled: false }), { wrapper });

    expect(mockGetMyJoinRequest).not.toHaveBeenCalled();
    expect(capturedOptions[0]?.enabled).toBe(false);
  });

  it("does not fetch without an id", () => {
    renderHook(() => useMyExperimentJoinRequest(undefined), { wrapper });

    expect(mockGetMyJoinRequest).not.toHaveBeenCalled();
    expect(capturedOptions[0]?.enabled).toBe(false);
  });

  it("treats a 404 as 'no request', not as an error to render", async () => {
    mockGetMyJoinRequest.mockRejectedValue(apiError(404));

    const { result } = renderHook(() => useMyExperimentJoinRequest("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isNone).toBe(true));
    expect(result.current.error).toBeUndefined();
    expect(result.current.requestId).toBeUndefined();
    expect(mockGetMyJoinRequest).toHaveBeenCalledTimes(1);
  });

  it("still reports other failures, and retries them", async () => {
    mockGetMyJoinRequest.mockRejectedValue(apiError(500));

    const { result } = renderHook(() => useMyExperimentJoinRequest("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(result.current.isNone).toBe(false);
    expect(mockGetMyJoinRequest).toHaveBeenCalledTimes(4);
  });

  it("suppresses the global toast", () => {
    renderHook(() => useMyExperimentJoinRequest("exp-1"), { wrapper });

    expect(capturedOptions[0]?.meta).toEqual({ suppressToast: true });
  });
});
