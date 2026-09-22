import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRequestJoinExperiment } from "./use-request-join-experiment";

const { mockCreateJoinRequest, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockCreateJoinRequest: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { key: () => ["experiments", "list"] },
      getExperimentAccess: { key: () => ["experiments", "access"] },
      getMyJoinRequest: { key: () => ["experiments", "my-join-request"] },
      createJoinRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationKey: ["experiments", "join"],
          mutationFn: (input: unknown) => mockCreateJoinRequest(input),
          ...opts,
        }),
      },
    },
  },
}));

vi.mock("sonner-native", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { name?: string }) => (vars?.name ? `${key}|${vars.name}` : key),
  }),
}));

let queryClient: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function invalidatedKeys() {
  return invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey);
}

const ALL_THREE = [
  ["experiments", "access"],
  ["experiments", "my-join-request"],
  ["experiments", "list"],
];

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  mockCreateJoinRequest.mockResolvedValue({ id: "req-1", status: "pending" });
});

afterEach(() => {
  queryClient.clear();
});

describe("useRequestJoinExperiment", () => {
  it("sends the flat { id, message } the contract declares", async () => {
    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1", message: "Tuesday field workshop" });

    await waitFor(() => expect(mockCreateJoinRequest).toHaveBeenCalled());
    expect(mockCreateJoinRequest).toHaveBeenCalledWith({
      id: "exp-1",
      message: "Tuesday field workshop",
    });
  });

  it("toasts success with the experiment's name", async () => {
    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith("experiments:join.sent|Canopy Phi2 Sweep");
  });

  it("toasts the server's own copy on error", async () => {
    mockCreateJoinRequest.mockRejectedValue(
      new Error("You already have access to this experiment"),
    );

    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("You already have access to this experiment");
  });

  it("falls back to the generic message when the error carried no copy", async () => {
    mockCreateJoinRequest.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("common:errorGeneric");
  });

  it("invalidates access, the request and every experiment listing on success", async () => {
    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });

  it("invalidates on error too — a 409 means the cached status was stale", async () => {
    mockCreateJoinRequest.mockRejectedValue(new Error("Already has access"));

    const { result } = renderHook(() => useRequestJoinExperiment("Canopy Phi2 Sweep"), { wrapper });

    result.current.requestJoin({ id: "exp-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });
});
