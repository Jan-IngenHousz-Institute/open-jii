// Import after mocking
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useGetUserProfile } from "./useGetUserProfile";

// 🔑 Hoist the mock function
const { useQueryMock } = vi.hoisted(() => {
  return { useQueryMock: vi.fn() };
});

// Mock BEFORE importing the SUT
vi.mock("@/lib/tsr", () => ({
  tsr: {
    users: {
      getUserProfile: {
        useQuery: useQueryMock,
      },
    },
  },
}));

describe("useGetUserProfile", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });

    renderHook(() => useGetUserProfile("user-123"), { wrapper: createWrapper() });

    expect(useQueryMock).toHaveBeenCalledWith({
      queryData: { params: { id: "user-123" } },
      queryKey: ["userProfile", "user-123"],
      enabled: true,
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  it("should return successful user profile data", () => {
    const mockData = {
      status: 200,
      body: {
        id: "user-123",
        username: "testuser",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        createdAt: "2023-01-01T00:00:00Z",
      },
    };

    useQueryMock.mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useGetUserProfile("user-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle 404 error for non-existent user", () => {
    const mockError = { status: 404, message: "User not found" };

    useQueryMock.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });

    const { result } = renderHook(() => useGetUserProfile("non-existent"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  it("should disable query when enabled is false", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });

    renderHook(() => useGetUserProfile("user-123", false), {
      wrapper: createWrapper(),
    });

    expect(useQueryMock).toHaveBeenCalledWith({
      queryData: { params: { id: "user-123" } },
      queryKey: ["userProfile", "user-123"],
      enabled: false,
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  it("should disable query when userId is empty", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });

    renderHook(() => useGetUserProfile(""), { wrapper: createWrapper() });

    expect(useQueryMock).toHaveBeenCalledWith({
      queryData: { params: { id: "" } },
      queryKey: ["userProfile", ""],
      enabled: false,
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  describe("retry logic", () => {
    let retryFunction: (failureCount: number, error: unknown) => boolean;

    beforeEach(() => {
      useQueryMock.mockImplementation(
        (options: { retry: (failureCount: number, error: unknown) => boolean }) => {
          retryFunction = options.retry;
          return { data: undefined, error: null, isLoading: true };
        },
      );

      renderHook(() => useGetUserProfile("user-123"), { wrapper: createWrapper() });
    });

    it("should NOT retry on 404 Not Found errors", () => {
      expect(retryFunction(0, { status: 404 })).toBe(false);
      expect(retryFunction(2, { status: 404 })).toBe(false);
    });

    it("should retry on network/other errors (up to 3 times)", () => {
      expect(retryFunction(0, { status: 500 })).toBe(true);
      expect(retryFunction(2, { status: 500 })).toBe(true);
      expect(retryFunction(3, { status: 500 })).toBe(false);
    });

    it("should handle odd error shapes", () => {
      expect(retryFunction(0, { message: "weird" })).toBe(true);
      expect(retryFunction(0, "string")).toBe(true);
      expect(retryFunction(0, { status: "bad" as unknown })).toBe(true);
      expect(retryFunction(0, {})).toBe(true);
    });
  });

  it("should handle loading state", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });

    const { result } = renderHook(() => useGetUserProfile("user-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should use different query keys for different user IDs", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });

    const wrapper = createWrapper();

    renderHook(() => useGetUserProfile("user-1"), { wrapper });
    renderHook(() => useGetUserProfile("user-2"), { wrapper });

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["userProfile", "user-1"] }),
    );
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["userProfile", "user-2"] }),
    );
  });
});
