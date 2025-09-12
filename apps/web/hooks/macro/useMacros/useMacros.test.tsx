import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { tsr } from "../../../lib/tsr";
import { useMacros } from "./useMacros";

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

  it("should call tsr.macros.listMacros.useQuery with empty filter by default", () => {
    // Arrange
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {},
      },
      queryKey: ["macros", undefined],
    });
  });

  it("should call tsr.macros.listMacros.useQuery with provided filter", () => {
    // Arrange
    const filter = {
      search: "test",
      language: "python" as const,
    };
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacros(filter), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: filter,
      },
      queryKey: ["macros", filter],
    });
  });

  it("should return data when query is successful", () => {
    // Arrange
    const mockMacros = [
      {
        id: "macro-1",
        name: "Python Macro",
        description: "A Python test macro",
        language: "python" as const,
        codeFile: "python_macro.py",
        createdBy: "user-123",
        createdByName: "Test User",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
      {
        id: "macro-2",
        name: "R Macro",
        description: "An R test macro",
        language: "r" as const,
        codeFile: "r_macro.r",
        createdBy: "user-456",
        createdByName: "Another User",
        createdAt: "2023-01-02T00:00:00Z",
        updatedAt: "2023-01-02T00:00:00Z",
      },
    ];
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: mockMacros },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toEqual(mockMacros);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should return loading state", () => {
    // Arrange
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it("should return error state when query fails", () => {
    // Arrange
    const mockError = new Error("Failed to fetch macros");
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(mockError);
  });

  it("should handle search filter parameter", () => {
    // Arrange
    const filter = { search: "python" };
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacros(filter), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: filter,
      },
      queryKey: ["macros", filter],
    });
  });

  it("should handle language filter parameter", () => {
    // Arrange
    const filter = { language: "r" as const };
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacros(filter), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: filter,
      },
      queryKey: ["macros", filter],
    });
  });

  it("should handle combined search and language filters", () => {
    // Arrange
    const filter = {
      search: "analysis",
      language: "javascript" as const,
    };
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacros(filter), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: filter,
      },
      queryKey: ["macros", filter],
    });
  });

  it("should use different query keys for different filters", () => {
    // Arrange
    const filter1 = { search: "test" };
    const filter2 = { language: "python" as const };
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    const wrapper = createWrapper();
    renderHook(() => useMacros(filter1), { wrapper });
    renderHook(() => useMacros(filter2), { wrapper });

    // Assert
    expect(mockUseQuery).toHaveBeenNthCalledWith(1, {
      queryData: {
        query: filter1,
      },
      queryKey: ["macros", filter1],
    });
    expect(mockUseQuery).toHaveBeenNthCalledWith(2, {
      queryData: {
        query: filter2,
      },
      queryKey: ["macros", filter2],
    });
  });

  it("should handle undefined data body gracefully", () => {
    // Arrange
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacros.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacros(), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
