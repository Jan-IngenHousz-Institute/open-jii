/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentAccess } from "./useExperimentAccess";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentAccess: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentAccess", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests by default
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
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "experiment-123" } },
      queryKey: ["experimentAccess", "experiment-123"],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
    });
  });

  it("should return successful experiment access data", () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "experiment-123",
          name: "Test Experiment",
          visibility: "private",
          status: "active",
        },
        hasAccess: true,
        isAdmin: false,
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle 404 error for non-existent experiment", () => {
    const mockError = {
      status: 404,
      message: "Experiment not found",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("non-existent"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle 403 error for unauthorized access", () => {
    const mockError = {
      status: 403,
      message: "You do not have permission to access this experiment",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("private-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
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
      mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as unknown;

      renderHook(() => useExperimentAccess("experiment-123"), {
        wrapper: createWrapper(),
      });
    });

    it("should NOT retry on 4xx client errors", () => {
      const error400 = { status: 400, message: "Bad Request" };
      const error401 = { status: 401, message: "Unauthorized" };
      const error403 = { status: 403, message: "Forbidden" };
      const error404 = { status: 404, message: "Not Found" };
      const error422 = { status: 422, message: "Unprocessable Entity" };

      // 400 Bad Request - should not retry
      expect(retryFunction(0, error400)).toBe(false);
      expect(retryFunction(1, error400)).toBe(false);

      // 401 Unauthorized - should not retry
      expect(retryFunction(0, error401)).toBe(false);

      // 403 Forbidden - should not retry
      expect(retryFunction(0, error403)).toBe(false);
      expect(retryFunction(1, error403)).toBe(false);
      expect(retryFunction(2, error403)).toBe(false);

      // 404 Not Found - should not retry
      expect(retryFunction(0, error404)).toBe(false);
      expect(retryFunction(1, error404)).toBe(false);

      // 422 Unprocessable Entity - should not retry
      expect(retryFunction(0, error422)).toBe(false);
    });

    it("should retry on 5xx server errors (up to 3 times)", () => {
      const error500 = { status: 500, message: "Internal Server Error" };
      const error502 = { status: 502, message: "Bad Gateway" };
      const error503 = { status: 503, message: "Service Unavailable" };

      expect(retryFunction(0, error500)).toBe(true);
      expect(retryFunction(1, error500)).toBe(true);
      expect(retryFunction(2, error500)).toBe(true);
      expect(retryFunction(3, error500)).toBe(false);

      expect(retryFunction(0, error502)).toBe(true);
      expect(retryFunction(0, error503)).toBe(true);
    });

    it("should retry on timeout/network errors (up to 3 times)", () => {
      const timeoutError = new Error("Network timeout");

      expect(retryFunction(0, timeoutError)).toBe(true);
      expect(retryFunction(1, timeoutError)).toBe(true);
      expect(retryFunction(2, timeoutError)).toBe(true);
      expect(retryFunction(3, timeoutError)).toBe(false);
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

      // Null error - retry (unknown error type)
      expect(retryFunction(0, null)).toBe(true);
    });
  });

  it("should work with public experiments", () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "public-experiment",
          name: "Public Experiment",
          visibility: "public",
          status: "active",
        },
        hasAccess: false, // User is not a member
        isAdmin: false,
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("public-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.body.experiment.visibility).toBe("public");
    expect(result.current.data?.body.hasAccess).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should work with admin access", () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "admin-experiment",
          name: "Admin Experiment",
          visibility: "private",
          status: "active",
        },
        hasAccess: true,
        isAdmin: true,
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("admin-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.body.hasAccess).toBe(true);
    expect(result.current.data?.body.isAdmin).toBe(true);
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const { result } = renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should use different query keys for different experiment IDs", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.experiments.getExperimentAccess.useQuery
    >;

    const wrapper = createWrapper();

    renderHook(() => useExperimentAccess("experiment-1"), { wrapper });
    renderHook(() => useExperimentAccess("experiment-2"), { wrapper });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experimentAccess", "experiment-1"],
      }),
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experimentAccess", "experiment-2"],
      }),
    );
  });
});
