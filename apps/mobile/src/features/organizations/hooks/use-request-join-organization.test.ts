import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRequestJoinOrganization } from "./use-request-join-organization";

const { mockCreateJoinRequest, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockCreateJoinRequest: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    organizations: {
      listOrganizations: { key: () => ["organizations", "list"] },
      getOrganization: { key: () => ["organizations", "detail"] },
      createOrganizationJoinRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationKey: ["organizations", "join"],
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

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  mockCreateJoinRequest.mockResolvedValue({ id: "req-1", status: "pending" });
});

afterEach(() => {
  queryClient.clear();
});

describe("useRequestJoinOrganization", () => {
  it("sends the flat { id, message } the contract declares", async () => {
    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1", message: "Tuesday practical" });

    await waitFor(() => expect(mockCreateJoinRequest).toHaveBeenCalled());
    expect(mockCreateJoinRequest).toHaveBeenCalledWith({
      id: "org-1",
      message: "Tuesday practical",
    });
  });

  it("toasts success with the organization's name", async () => {
    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith("organizations:join.sent|Photosynthesis Lab");
  });

  it("toasts the server's own copy on error", async () => {
    mockCreateJoinRequest.mockRejectedValue(
      new Error("You are already a member of this organization"),
    );

    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("You are already a member of this organization");
  });

  it("falls back to the generic message when the error carried no copy", async () => {
    mockCreateJoinRequest.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("common:errorGeneric");
  });

  it("invalidates both the directory and the detail on success", async () => {
    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    expect(invalidatedKeys()).toEqual([
      ["organizations", "list"],
      ["organizations", "detail"],
    ]);
  });

  it("invalidates on error too — a 409 means the cached status was stale", async () => {
    mockCreateJoinRequest.mockRejectedValue(new Error("Already a member"));

    const { result } = renderHook(() => useRequestJoinOrganization("Photosynthesis Lab"), {
      wrapper,
    });

    result.current.requestJoin({ id: "org-1" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    expect(invalidatedKeys()).toEqual([
      ["organizations", "list"],
      ["organizations", "detail"],
    ]);
  });
});
