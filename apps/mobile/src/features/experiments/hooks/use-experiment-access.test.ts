import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExperimentAccess } from "./use-experiment-access";

const { mockGetExperimentAccess, capturedOptions } = vi.hoisted(() => ({
  mockGetExperimentAccess: vi.fn(),
  capturedOptions: [] as Record<string, unknown>[],
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      getExperimentAccess: {
        queryOptions: ({ input, ...opts }: { input: { id: string } }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["experiment-access", input.id],
            queryFn: () => mockGetExperimentAccess(input),
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

const ACCESS = {
  experiment: { id: "exp-1", name: "Canopy Phi2 Sweep", status: "active" },
  hasAccess: true,
  isAdmin: false,
  capabilities: {},
  membershipStatus: "member",
};

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockGetExperimentAccess.mockResolvedValue(ACCESS);
});

afterEach(() => {
  queryClient.clear();
});

describe("useExperimentAccess", () => {
  it("fetches by id and exposes the experiment and its membership status", async () => {
    const { result } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.experiment).toBeDefined());
    expect(mockGetExperimentAccess).toHaveBeenCalledWith({ id: "exp-1" });
    expect(result.current.membershipStatus).toBe("member");
  });

  it("does not fetch without an id", () => {
    renderHook(() => useExperimentAccess(undefined), { wrapper });

    expect(mockGetExperimentAccess).not.toHaveBeenCalled();
    expect(capturedOptions[0]?.enabled).toBe(false);
  });

  it("suppresses the global toast: the screen renders the unavailable state itself", () => {
    renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    expect(capturedOptions[0]?.meta).toEqual({ suppressToast: true });
  });

  it("refetches on mount and on foreground, so an approval elsewhere lands here", () => {
    renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    expect(capturedOptions[0]?.refetchOnMount).toBe(true);
    expect(capturedOptions[0]?.refetchOnWindowFocus).toBe(true);
  });

  it.each([404, 403])("does not retry a %i — it is an answer, not a failure", async (status) => {
    mockGetExperimentAccess.mockRejectedValue(apiError(status));

    const { result } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(mockGetExperimentAccess).toHaveBeenCalledTimes(1);
  });

  it.each([404, 403])(
    "reports isUnavailable for a fresh %i even when an experiment is already cached",
    async (status) => {
      const { result, rerender } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });
      await waitFor(() => expect(result.current.experiment).toBeDefined());

      mockGetExperimentAccess.mockRejectedValue(apiError(status));
      await result.current.refetch();
      rerender();

      await waitFor(() => expect(result.current.isUnavailable).toBe(true));
      expect(result.current.experiment).toBeDefined();
    },
  );

  it("does not report isUnavailable for a network failure with cached data", async () => {
    const { result, rerender } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });
    await waitFor(() => expect(result.current.experiment).toBeDefined());

    mockGetExperimentAccess.mockRejectedValue(new Error("Network request failed"));
    await result.current.refetch();
    rerender();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.experiment).toBeDefined();
  });

  it("retries other errors", async () => {
    mockGetExperimentAccess.mockRejectedValue(apiError(500));

    const { result } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(mockGetExperimentAccess).toHaveBeenCalledTimes(4);
  });

  it("reports isPaused so the screen can tell offline from loading", async () => {
    const { result } = renderHook(() => useExperimentAccess("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPaused).toBe(false);
  });
});
