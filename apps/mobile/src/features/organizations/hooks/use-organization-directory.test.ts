import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOrganizationDirectory } from "./use-organization-directory";

const { mockListOrganizations } = vi.hoisted(() => ({ mockListOrganizations: vi.fn() }));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    organizations: {
      listOrganizations: {
        queryOptions: ({ input, ...opts }: { input: unknown }) => ({
          queryKey: ["organizations", input],
          queryFn: () => mockListOrganizations(input),
          ...opts,
        }),
      },
    },
  },
}));

function entry(id: string, name: string) {
  return {
    id,
    name,
    slug: null,
    logo: null,
    type: null,
    description: null,
    location: null,
    memberCount: 1,
    resourceCount: 0,
    visibility: "public" as const,
    membershipStatus: "none" as const,
  };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockListOrganizations.mockResolvedValue({ organizations: [] });
});

afterEach(() => {
  queryClient.clear();
});

describe("useOrganizationDirectory", () => {
  it("sends no search and scope 'all' when called with no term", async () => {
    const { result } = renderHook(() => useOrganizationDirectory(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListOrganizations).toHaveBeenCalledWith({ search: undefined, scope: "all" });
  });

  it("sends an empty search as undefined, never as an empty string", async () => {
    const { result } = renderHook(() => useOrganizationDirectory({ search: "" }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListOrganizations).toHaveBeenCalledWith({ search: undefined, scope: "all" });
  });

  it("sends a whitespace-only search as undefined", async () => {
    const { result } = renderHook(() => useOrganizationDirectory({ search: "   " }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListOrganizations).toHaveBeenCalledWith({ search: undefined, scope: "all" });
  });

  it("trims a real term and keeps scope 'all'", async () => {
    const { result } = renderHook(() => useOrganizationDirectory({ search: "  lab  " }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListOrganizations).toHaveBeenCalledWith({ search: "lab", scope: "all" });
  });

  it("preserves server order", async () => {
    const rows = [entry("2", "Zebra Institute"), entry("1", "Alpha Lab")];
    mockListOrganizations.mockResolvedValue({ organizations: rows });

    const { result } = renderHook(() => useOrganizationDirectory(), { wrapper });

    await waitFor(() => expect(result.current.organizations).toHaveLength(2));
    expect(result.current.organizations?.map((o) => o.id)).toEqual(["2", "1"]);
  });

  it("keeps the previous list on screen while a new term fetches", async () => {
    const first = [entry("1", "Alpha Lab")];
    mockListOrganizations.mockResolvedValue({ organizations: first });

    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useOrganizationDirectory({ search }),
      { wrapper, initialProps: { search: "a" } },
    );
    await waitFor(() => expect(result.current.organizations).toHaveLength(1));

    let resolveSecond: (value: { organizations: unknown[] }) => void = () => undefined;
    mockListOrganizations.mockReturnValue(
      new Promise<{ organizations: unknown[] }>((resolve) => {
        resolveSecond = resolve;
      }),
    );
    rerender({ search: "al" });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.organizations?.map((o) => o.id)).toEqual(["1"]);
    expect(result.current.isLoading).toBe(false);

    resolveSecond({ organizations: [entry("2", "Alpine Lab")] });
    await waitFor(() => expect(result.current.organizations?.map((o) => o.id)).toEqual(["2"]));
  });

  it("leaves organizations undefined when no response has arrived", async () => {
    mockListOrganizations.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useOrganizationDirectory(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.organizations).toBeUndefined();
  });

  it("distinguishes a genuinely empty directory from a missing one", async () => {
    mockListOrganizations.mockResolvedValue({ organizations: [] });

    const { result } = renderHook(() => useOrganizationDirectory(), { wrapper });

    await waitFor(() => expect(result.current.organizations).toBeDefined());
    expect(result.current.organizations).toEqual([]);
  });
});
