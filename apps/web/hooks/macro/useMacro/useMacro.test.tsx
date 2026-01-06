import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { tsr } from "../../../lib/tsr";
import { useMacro } from "./useMacro";

// Mock the tsr client
vi.mock("../../../lib/tsr", () => ({
  tsr: {
    macros: {
      getMacro: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useMacro", () => {
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

  it("should call tsr.macros.getMacro.useQuery with correct parameters", () => {
    // Arrange
    const mockId = "test-macro-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: { id: mockId, name: "Test Macro" } },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    renderHook(() => useMacro(mockId), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockId } },
      queryKey: ["macro", mockId],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  it("should return data when query is successful", () => {
    // Arrange
    const mockId = "test-macro-id";
    const mockMacro = {
      id: mockId,
      name: "Test Macro",
      description: "A test macro",
      language: "python" as const,
      code: "test.py",
      createdBy: "user-123",
      createdByName: "Test User",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: mockMacro },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacro(mockId), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toEqual(mockMacro);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should return loading state", () => {
    // Arrange
    const mockId = "test-macro-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacro(mockId), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it("should return error state when query fails", () => {
    // Arrange
    const mockId = "test-macro-id";
    const mockError = new Error("Failed to fetch macro");
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacro(mockId), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(mockError);
  });

  it("should handle undefined data body gracefully", () => {
    // Arrange
    const mockId = "test-macro-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    const { result } = renderHook(() => useMacro(mockId), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should use different query keys for different macro IDs", () => {
    // Arrange
    const mockId1 = "macro-1";
    const mockId2 = "macro-2";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.macros.getMacro.useQuery = mockUseQuery;

    // Act
    const wrapper = createWrapper();
    renderHook(() => useMacro(mockId1), { wrapper });
    renderHook(() => useMacro(mockId2), { wrapper });

    // Assert
    expect(mockUseQuery).toHaveBeenNthCalledWith(1, {
      queryData: { params: { id: mockId1 } },
      queryKey: ["macro", mockId1],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
    expect(mockUseQuery).toHaveBeenNthCalledWith(2, {
      queryData: { params: { id: mockId2 } },
      queryKey: ["macro", mockId2],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });
});
