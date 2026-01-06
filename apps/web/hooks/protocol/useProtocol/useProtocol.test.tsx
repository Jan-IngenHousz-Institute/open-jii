import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { tsr } from "../../../lib/tsr";
import { useProtocol } from "./useProtocol";

// Mock the tsr client
vi.mock("../../../lib/tsr", () => ({
  tsr: {
    protocols: {
      getProtocol: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useProtocol", () => {
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

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    renderHook(() => useProtocol("protocol-123"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "protocol-123" } },
      queryKey: ["protocol", "protocol-123"],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  it("should return successful protocol data", () => {
    const mockData = {
      status: 200,
      body: {
        id: "protocol-123",
        name: "Test Protocol",
        description: "A test protocol",
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const { result } = renderHook(() => useProtocol("protocol-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle 404 error for non-existent protocol", () => {
    const mockError = {
      status: 404,
      message: "Protocol not found",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const { result } = renderHook(() => useProtocol("non-existent"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const { result } = renderHook(() => useProtocol("protocol-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  describe("retry logic", () => {
    let retryFunction: (failureCount: number, error: unknown) => boolean;

    beforeEach(() => {
      const mockUseQuery = vi
        .fn()
        .mockImplementation(
          (options: { retry: (failureCount: number, error: unknown) => boolean }) => {
            retryFunction = options.retry;
            return {
              data: undefined,
              error: null,
              isLoading: true,
            };
          },
        );
      mockTsr.protocols.getProtocol.useQuery = mockUseQuery as unknown;

      renderHook(() => useProtocol("protocol-123"), {
        wrapper: createWrapper(),
      });
    });

    it("should NOT retry on 4xx client errors", () => {
      const error400 = { status: 400, message: "Bad Request" };
      const error403 = { status: 403, message: "Forbidden" };
      const error404 = { status: 404, message: "Not Found" };
      const error422 = { status: 422, message: "Unprocessable Entity" };

      // 400 Bad Request - should not retry
      expect(retryFunction(0, error400)).toBe(false);
      expect(retryFunction(1, error400)).toBe(false);

      // 403 Forbidden - should not retry
      expect(retryFunction(0, error403)).toBe(false);

      // 404 Not Found - should not retry
      expect(retryFunction(0, error404)).toBe(false);

      // 422 Unprocessable Entity - should not retry
      expect(retryFunction(0, error422)).toBe(false);
    });

    it("should retry on 5xx server errors (up to 3 times)", () => {
      const error500 = { status: 500, message: "Internal Server Error" };

      expect(retryFunction(0, error500)).toBe(true);
      expect(retryFunction(1, error500)).toBe(true);
      expect(retryFunction(2, error500)).toBe(true);
      expect(retryFunction(3, error500)).toBe(false);
    });

    it("should retry on network errors (up to 3 times)", () => {
      const networkError = new Error("Network timeout");

      expect(retryFunction(0, networkError)).toBe(true);
      expect(retryFunction(1, networkError)).toBe(true);
      expect(retryFunction(2, networkError)).toBe(true);
      expect(retryFunction(3, networkError)).toBe(false);
    });

    it("should handle edge cases in error object structure", () => {
      // Error without status property - retry (unknown error type)
      const errorWithoutStatus = { message: "Some error" };
      expect(retryFunction(0, errorWithoutStatus)).toBe(true);

      // String error - retry (unknown error type)
      expect(retryFunction(0, "String error")).toBe(true);

      // Error object with non-numeric status - retry (can't determine if 4xx)
      const errorWithBadStatus = { status: "bad" };
      expect(retryFunction(0, errorWithBadStatus)).toBe(true);

      // Empty error object - retry (unknown error type)
      const emptyError = {};
      expect(retryFunction(0, emptyError)).toBe(true);
    });
  });

  it("should use different query keys for different protocol IDs", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const wrapper = createWrapper();

    renderHook(() => useProtocol("protocol-1"), { wrapper });
    renderHook(() => useProtocol("protocol-2"), { wrapper });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["protocol", "protocol-1"],
      }),
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["protocol", "protocol-2"],
      }),
    );
  });
});
