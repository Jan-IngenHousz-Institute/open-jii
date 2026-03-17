import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { tsr } from "../../../lib/tsr";
import { useProtocols } from "./useProtocols";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/platform/protocols",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the tsr client
vi.mock("../../../lib/tsr", () => ({
  tsr: {
    protocols: {
      listProtocols: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock useDebounce to return value immediately
vi.mock("../../useDebounce", () => ({
  useDebounce: (value: string) => [value],
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useProtocols", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call tsr with 'my' filter by default", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols(), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: "my",
            search: undefined,
          },
        },
      }),
    );
  });

  it("should call tsr with no filter when set to 'all'", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols({ initialFilter: "all" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: undefined,
            search: undefined,
          },
        },
      }),
    );
  });

  it("should return protocols when query is successful", () => {
    const mockProtocols = [
      {
        id: "protocol-1",
        name: "Test Protocol",
        description: "A test protocol",
        createdBy: "user-123",
        createdByName: "Test User",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ];
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: mockProtocols },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols(), {
      wrapper: createWrapper(),
    });

    expect(result.current.protocols).toEqual(mockProtocols);
  });

  it("should return undefined protocols when loading", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols(), {
      wrapper: createWrapper(),
    });

    expect(result.current.protocols).toBeUndefined();
  });

  it("should expose filter and setFilter", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filter).toBe("all");
    expect(typeof result.current.setFilter).toBe("function");
  });

  it("should expose search and setSearch", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols(), {
      wrapper: createWrapper(),
    });

    expect(result.current.search).toBe("");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("should auto-switch to 'all' when user has no protocols", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols({ initialFilter: "my" }), {
      wrapper: createWrapper(),
    });

    // After auto-switch, filter should be "all"
    expect(result.current.filter).toBe("all");
  });

  it("should not auto-switch when there are protocols", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: {
        body: [
          {
            id: "protocol-1",
            name: "My Protocol",
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocols({ initialFilter: "my" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.filter).toBe("my");
  });

  it("should not auto-switch when there is a search term", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(
      () => useProtocols({ initialFilter: "my", initialSearch: "test" }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.filter).toBe("my");
  });

  it("should pass search to query when initialSearch is provided", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols({ initialSearch: "test" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: "my",
            search: "test",
          },
        },
      }),
    );
  });

  it("should not pass search when it is empty string", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols({ initialSearch: "" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: "my",
            search: undefined,
          },
        },
      }),
    );
  });

  it("should not pass search when it is only whitespace", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols({ initialSearch: "   " }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: "my",
            search: undefined,
          },
        },
      }),
    );
  });

  it("should include protocols and debouncedSearch in queryKey", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocols.useQuery = mockUseQuery;

    renderHook(() => useProtocols({ initialSearch: "test" }), {
      wrapper: createWrapper(),
    });

    const lastCall = mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1] as unknown[];
    const callArg = lastCall[0] as { queryKey: string[] };
    expect(callArg.queryKey).toEqual(["protocols", "my", "test"]);
  });
});
