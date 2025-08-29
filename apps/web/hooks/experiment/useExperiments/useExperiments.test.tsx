import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { ExperimentStatus } from "@repo/api";

import { useDebounce } from "../../useDebounce";
import { useExperiments } from "./useExperiments";

// Mock the tsr client
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      listExperiments: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock the useDebounce hook
vi.mock("../../useDebounce", () => ({
  useDebounce: vi.fn(),
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;
const mockUseDebounce = useDebounce as ReturnType<typeof vi.fn>;

describe("useExperiments", () => {
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

    // Default mock for useDebounce - returns the search term immediately
    mockUseDebounce.mockImplementation((value: string) => [value]);
  });

  it("should initialize with default values", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.filter).toBe("my");
    expect(result.current.status).toBeUndefined();
    expect(result.current.search).toBe("");
    expect(result.current.data).toBeUndefined();
  });

  it("should initialize with custom values", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(
      () =>
        useExperiments({
          initialFilter: "all",
          initialStatus: "active" as ExperimentStatus,
          initialSearch: "test search",
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.filter).toBe("all");
    expect(result.current.status).toBe("active");
    expect(result.current.search).toBe("test search");
  });

  it("should call useQuery with correct parameters for default filter", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          filter: "my",
          status: undefined,
          search: undefined,
        },
      },
      queryKey: ["experiments", "my", undefined, ""],
    });
  });

  it("should call useQuery with undefined filter when filter is 'all'", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    renderHook(() => useExperiments({ initialFilter: "all" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          filter: undefined, // Should be undefined when filter is "all"
          status: undefined,
          search: undefined,
        },
      },
      queryKey: ["experiments", "all", undefined, ""],
    });
  });

  it("should update filter state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setFilter("member");
    });

    expect(result.current.filter).toBe("member");
  });

  it("should update status state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setStatus("draft" as ExperimentStatus);
    });

    expect(result.current.status).toBe("draft");
  });

  it("should update search state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearch("new search term");
    });

    expect(result.current.search).toBe("new search term");
  });

  it("should use debounced search value in query", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    // Mock useDebounce to return a different debounced value
    mockUseDebounce.mockReturnValue(["debounced search"]);

    renderHook(() => useExperiments({ initialSearch: "original search" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseDebounce).toHaveBeenCalledWith("original search", 300);
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          filter: "my",
          status: undefined,
          search: "debounced search",
        },
      },
      queryKey: ["experiments", "my", undefined, "debounced search"],
    });
  });

  it("should not pass search to query when debounced search is empty or whitespace", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    // Test empty string
    mockUseDebounce.mockReturnValue([""]);
    renderHook(() => useExperiments({ initialSearch: "test" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          filter: "my",
          status: undefined,
          search: undefined, // Should be undefined for empty string
        },
      },
      queryKey: ["experiments", "my", undefined, ""],
    });

    // Test whitespace string
    mockUseQuery.mockClear();
    mockUseDebounce.mockReturnValue(["   "]);
    renderHook(() => useExperiments({ initialSearch: "test" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          filter: "my",
          status: undefined,
          search: undefined, // Should be undefined for whitespace
        },
      },
      queryKey: ["experiments", "my", undefined, "   "],
    });
  });

  it("should return successful experiments data", () => {
    const mockData = {
      status: 200,
      body: [
        {
          id: "exp-1",
          name: "First Experiment",
          status: "active",
          visibility: "private",
        },
        {
          id: "exp-2",
          name: "Second Experiment",
          status: "draft",
          visibility: "public",
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
  });

  it("should handle error state", () => {
    const mockError = {
      status: 500,
      message: "Internal Server Error",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperiments({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
  });

  it("should generate different query keys for different parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const wrapper = createWrapper();

    // First hook with different parameters
    renderHook(
      () =>
        useExperiments({
          initialFilter: "my",
          initialStatus: "active" as ExperimentStatus,
          initialSearch: "search1",
        }),
      { wrapper },
    );

    // Second hook with different parameters
    renderHook(
      () =>
        useExperiments({
          initialFilter: "member",
          initialStatus: "draft" as ExperimentStatus,
          initialSearch: "search2",
        }),
      { wrapper },
    );

    // Check that different query keys were used
    const calls = mockUseQuery.mock.calls;
    expect((calls[0]?.[0] as { queryKey: unknown[] }).queryKey).toEqual([
      "experiments",
      "my",
      "active",
      "search1",
    ]);
    expect((calls[1]?.[0] as { queryKey: unknown[] }).queryKey).toEqual([
      "experiments",
      "member",
      "draft",
      "search2",
    ]);
  });

  it("should work with all filter types", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listExperiments.useQuery = mockUseQuery;

    const wrapper = createWrapper();

    const filterTypes = ["my", "member", "related", "all"] as const;

    filterTypes.forEach((filter) => {
      mockUseQuery.mockClear();

      renderHook(() => useExperiments({ initialFilter: filter }), { wrapper });

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryData: {
          query: {
            filter: filter === "all" ? undefined : filter,
            status: undefined,
            search: undefined,
          },
        },
        queryKey: ["experiments", filter, undefined, ""],
      });
    });
  });
});
