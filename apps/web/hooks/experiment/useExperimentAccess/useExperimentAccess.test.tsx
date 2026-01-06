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
