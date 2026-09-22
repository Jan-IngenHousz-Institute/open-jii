import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResolveJoinCode } from "./use-resolve-join-code";

const { mockResolveJoinCode, capturedOptions } = vi.hoisted(() => ({
  mockResolveJoinCode: vi.fn(),
  capturedOptions: [] as Record<string, unknown>[],
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      resolveJoinCode: {
        queryOptions: ({ input, ...opts }: { input: { code: string } }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["join-code", input.code],
            queryFn: () => mockResolveJoinCode(input),
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

const PREVIEW = {
  experiment: {
    id: "exp-1",
    name: "Canopy Phi2 Sweep",
    description: null,
    organizationName: "Canopy Lab",
    status: "active",
    hasWorkbook: true,
  },
  membershipStatus: "none",
  expiresAt: "2026-09-25T00:00:00.000Z",
};

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockResolveJoinCode.mockResolvedValue(PREVIEW);
});

afterEach(() => {
  queryClient.clear();
});

describe("useResolveJoinCode", () => {
  it("previews the experiment behind the code", async () => {
    const { result } = renderHook(() => useResolveJoinCode("KP7Q4WMX"), { wrapper });

    await waitFor(() => expect(result.current.preview).toBeDefined());
    expect(mockResolveJoinCode).toHaveBeenCalledWith({ code: "KP7Q4WMX" });
    expect(result.current.preview?.experiment.name).toBe("Canopy Phi2 Sweep");
  });

  it.each([undefined, null, ""])("does not fetch without a code (%s)", (code) => {
    renderHook(() => useResolveJoinCode(code), { wrapper });

    expect(mockResolveJoinCode).not.toHaveBeenCalled();
    expect(capturedOptions[0]?.enabled).toBe(false);
  });

  it.each([
    [404, "an unknown, expired or revoked code"],
    [403, "an archived experiment"],
    [429, "a throttled caller"],
  ])("does not retry a %i — %s is an answer", async (status) => {
    mockResolveJoinCode.mockRejectedValue(apiError(status));

    const { result } = renderHook(() => useResolveJoinCode("KP7Q4WMX"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(mockResolveJoinCode).toHaveBeenCalledTimes(1);
  });

  it("retries a transient server failure", async () => {
    mockResolveJoinCode.mockRejectedValue(apiError(500));

    const { result } = renderHook(() => useResolveJoinCode("KP7Q4WMX"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(mockResolveJoinCode).toHaveBeenCalledTimes(4);
  });

  it("suppresses the global toast: the screen renders its own inline copy", () => {
    renderHook(() => useResolveJoinCode("KP7Q4WMX"), { wrapper });

    expect(capturedOptions[0]?.meta).toEqual({ suppressToast: true });
  });

  it("reports isPaused so the screen can tell offline from loading", async () => {
    const { result } = renderHook(() => useResolveJoinCode("KP7Q4WMX"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPaused).toBe(false);
  });
});
