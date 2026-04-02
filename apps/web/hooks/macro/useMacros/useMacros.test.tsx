import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { tsr } from "../../../lib/tsr";
import { useMacros } from "./useMacros";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/platform/macros",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the tsr client
vi.mock("../../../lib/tsr", () => ({
  tsr: {
    macros: {
      listMacros: {
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

describe("useMacros", () => {
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
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: "my",
            search: undefined,
            language: undefined,
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
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    renderHook(() => useMacros({ initialFilter: "all" }), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: {
            filter: undefined,
            search: undefined,
            language: undefined,
          },
        },
      }),
    );
  });

  it("should return data when query is successful", () => {
    const mockMacros = [
      {
        id: "macro-1",
        name: "Python Macro",
        description: "A Python test macro",
        language: "python" as const,
        code: "python_macro.py",
        filename: "python_macro.py",
        sortOrder: null,
        createdBy: "user-123",
        createdByName: "Test User",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ];
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: mockMacros },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockMacros);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should return loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("should return error state when query fails", () => {
    const mockError = new Error("Failed to fetch macros");
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBe(mockError);
  });

  it("should expose filter and setFilter", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros(), {
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
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    expect(result.current.search).toBe("");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("should accept initialLanguage parameter", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacros({ initialLanguage: "python" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.language).toBe("python");
    const lastCall = mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1] as unknown[];
    const callArg = lastCall[0] as { queryData: { query: Record<string, unknown> } };
    expect(callArg.queryData.query.language).toBe("python");
  });
});
