import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDiscoverExperiments } from "./use-discover-experiments";

const { mockListExperiments, capturedOptions } = vi.hoisted(() => ({
  mockListExperiments: vi.fn(),
  capturedOptions: [] as Record<string, any>[],
}));

// `infiniteOptions` takes `input` as a function of the page param; the mock
// calls it the way the real utility does so the assertions see real inputs.
vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: {
        infiniteOptions: ({
          input,
          ...opts
        }: {
          input: (page: number) => Record<string, unknown>;
        }) => {
          capturedOptions.push({ input, ...opts });
          return {
            queryKey: ["experiments", "listExperiments", input(1)],
            queryFn: ({ pageParam }: { pageParam: number }) =>
              mockListExperiments(input(pageParam)),
            ...opts,
          };
        },
      },
    },
  },
}));

function row(id: string, overrides: Record<string, unknown> = {}) {
  return { id, name: `Experiment ${id}`, membershipStatus: "none", ...overrides };
}

function page(items: unknown[], pageNumber: number, totalPages: number) {
  return { items, page: pageNumber, pageSize: 20, totalPages, totalCount: totalPages * 20 };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions.length = 0;
  onlineManager.setOnline(true);
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockListExperiments.mockResolvedValue(page([row("e1")], 1, 1));
});

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
});

describe("useDiscoverExperiments", () => {
  it("browses the whole accessible set, 20 at a time", async () => {
    const { result } = renderHook(() => useDiscoverExperiments(), { wrapper });

    await waitFor(() => expect(result.current.experiments).toBeDefined());
    expect(mockListExperiments).toHaveBeenCalledWith({
      scope: "all",
      search: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it.each([
    ["an empty term", ""],
    ["a whitespace-only term", "   "],
  ])("sends %s as undefined, never as a string", async (_label, search) => {
    const { result } = renderHook(() => useDiscoverExperiments({ search }), { wrapper });

    await waitFor(() => expect(result.current.experiments).toBeDefined());
    expect(mockListExperiments).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it("trims a real term before sending it", async () => {
    const { result } = renderHook(() => useDiscoverExperiments({ search: "  canopy  " }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.experiments).toBeDefined());
    expect(mockListExperiments).toHaveBeenCalledWith(
      expect.objectContaining({ search: "canopy", scope: "all" }),
    );
  });

  it("flattens the envelope's items across pages", async () => {
    mockListExperiments.mockImplementation((input: { page: number }) =>
      Promise.resolve(page([row(`e${input.page}`)], input.page, 2)),
    );

    const { result } = renderHook(() => useDiscoverExperiments(), { wrapper });

    await waitFor(() => expect(result.current.experiments).toHaveLength(1));
    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.experiments).toHaveLength(2));
    expect(result.current.experiments?.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(mockListExperiments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("asks for the next page only while the envelope says there is one", async () => {
    mockListExperiments.mockResolvedValue(page([row("e1")], 1, 1));

    const { result } = renderHook(() => useDiscoverExperiments(), { wrapper });

    await waitFor(() => expect(result.current.experiments).toBeDefined());
    expect(result.current.hasNextPage).toBe(false);
  });

  it("reports a next page when the last page is not the last", async () => {
    mockListExperiments.mockResolvedValue(page([row("e1")], 1, 3));

    const { result } = renderHook(() => useDiscoverExperiments(), { wrapper });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  });

  it("keeps the previous results on screen while a new term fetches", async () => {
    const { result, rerender } = renderHook(({ search }) => useDiscoverExperiments({ search }), {
      wrapper,
      initialProps: { search: "" },
    });
    await waitFor(() => expect(result.current.experiments).toHaveLength(1));

    let resolveSecond: (value: unknown) => void = () => undefined;
    mockListExperiments.mockReturnValue(
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
    );
    rerender({ search: "canopy" });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.experiments).toHaveLength(1);

    resolveSecond(page([row("e2"), row("e3")], 1, 1));
    await waitFor(() => expect(result.current.experiments).toHaveLength(2));
  });

  it("leaves experiments undefined and reports isPaused on a cold offline load", async () => {
    onlineManager.setOnline(false);
    mockListExperiments.mockRejectedValue(new Error("Network request failed"));

    const { result } = renderHook(() => useDiscoverExperiments(), { wrapper });

    await waitFor(() => expect(result.current.isPaused).toBe(true));
    expect(result.current.experiments).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("runs nothing while disabled, so the inactive tab costs no request", async () => {
    const { result } = renderHook(() => useDiscoverExperiments({ enabled: false }), { wrapper });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(mockListExperiments).not.toHaveBeenCalled();
    expect(result.current.experiments).toBeUndefined();
  });

  it("suppresses the global toast and refetches on mount and foreground", () => {
    renderHook(() => useDiscoverExperiments(), { wrapper });

    expect(capturedOptions[0]?.meta).toEqual({ suppressToast: true });
    expect(capturedOptions[0]?.refetchOnMount).toBe(true);
    expect(capturedOptions[0]?.refetchOnWindowFocus).toBe(true);
    expect(capturedOptions[0]?.networkMode).toBe("offlineFirst");
  });

  it("caps its lifetime at five minutes rather than the app-wide infinite gcTime", () => {
    renderHook(() => useDiscoverExperiments(), { wrapper });

    expect(capturedOptions[0]?.gcTime).toBe(5 * 60 * 1000);
  });
});
