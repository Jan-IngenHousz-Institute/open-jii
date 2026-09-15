import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCancelMyJoinRequest } from "./use-cancel-my-join-request";

const { mockCancelJoinRequest, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockCancelJoinRequest: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    organizations: {
      listOrganizations: { key: () => ["organizations", "list"] },
      getOrganization: { key: () => ["organizations", "detail"] },
      cancelMyOrganizationJoinRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationKey: ["organizations", "cancel-join"],
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

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  mockCancelJoinRequest.mockResolvedValue(undefined);
});

afterEach(() => {
  queryClient.clear();
});

describe("useCancelMyJoinRequest", () => {
  it("cancels by organization id and toasts success", async () => {
    const { result } = renderHook(() => useCancelMyJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "org-1" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockCancelJoinRequest).toHaveBeenCalledWith({ id: "org-1" });
    expect(mockToastSuccess).toHaveBeenCalledWith("organizations:join.cancelled");
  });

  it("passes the server's copy through on error", async () => {
    mockCancelJoinRequest.mockRejectedValue(
      new Error("You have no pending request for this organization"),
    );

    const { result } = renderHook(() => useCancelMyJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "org-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith(
      "You have no pending request for this organization",
    );
  });

  it("falls back to the generic message when the error carried no copy", async () => {
    mockCancelJoinRequest.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useCancelMyJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "org-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("common:errorGeneric");
  });

  it("invalidates the directory and the detail on success", async () => {
    const { result } = renderHook(() => useCancelMyJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "org-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    expect(invalidatedKeys()).toEqual([
      ["organizations", "list"],
      ["organizations", "detail"],
    ]);
  });

  it("invalidates on error too — a 404 means the request was already decided", async () => {
    mockCancelJoinRequest.mockRejectedValue(new Error("No pending request"));

    const { result } = renderHook(() => useCancelMyJoinRequest(), { wrapper });

    result.current.cancelRequest({ id: "org-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    expect(invalidatedKeys()).toEqual([
      ["organizations", "list"],
      ["organizations", "detail"],
    ]);
  });
});
