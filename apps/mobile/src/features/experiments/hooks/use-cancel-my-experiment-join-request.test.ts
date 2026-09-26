import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCancelMyExperimentJoinRequest } from "./use-cancel-my-experiment-join-request";

const { mockCancelJoinRequest, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockCancelJoinRequest: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { key: () => ["experiments", "list"] },
      getExperimentAccess: { key: () => ["experiments", "access"] },
      getMyJoinRequest: { key: () => ["experiments", "my-join-request"] },
      cancelJoinRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationKey: ["experiments", "cancel-join"],
          mutationFn: (input: unknown) => mockCancelJoinRequest(input),
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
  useTranslation: () => ({ t: (key: string) => key }),
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
  mockCancelJoinRequest.mockResolvedValue(undefined);
});

afterEach(() => {
  queryClient.clear();
});

describe("useCancelMyExperimentJoinRequest", () => {
  it("sends the flat { id, requestId } the contract declares", async () => {
    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(mockCancelJoinRequest).toHaveBeenCalled());
    expect(mockCancelJoinRequest).toHaveBeenCalledWith({ id: "exp-1", requestId: "req-1" });
  });

  it("toasts on success", async () => {
    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith("experiments:join.cancelled");
  });

  it("toasts the server's own copy on error", async () => {
    mockCancelJoinRequest.mockRejectedValue(new Error("This request was already decided"));

    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("This request was already decided");
  });

  it("falls back to the generic message when the error carried no copy", async () => {
    mockCancelJoinRequest.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("common:errorGeneric");
  });

  it("invalidates access, the request and every experiment listing on success", async () => {
    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });

  it("invalidates on error too — a 404 means the request was decided elsewhere", async () => {
    mockCancelJoinRequest.mockRejectedValue(new Error("No pending request"));

    const { result } = renderHook(() => useCancelMyExperimentJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "exp-1", requestId: "req-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });
});
