/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useTransferRequests } from "./useTransferRequests";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      listTransferRequests: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useTransferRequests", () => {
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
    mockTsr.experiments.listTransferRequests.useQuery = mockUseQuery;

    renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryKey: ["transferRequests"],
    });
  });

  it("should return successful transfer requests data", () => {
    const mockData = {
      status: 200,
      body: [
        {
          requestId: "req-1",
          projectIdOld: "123",
          projectUrlOld: "https://test.com",
          status: "pending",
          requestedAt: "2024-01-01T00:00:00Z",
        },
        {
          requestId: "req-2",
          projectIdOld: "456",
          projectUrlOld: "https://test2.com",
          status: "completed",
          requestedAt: "2024-01-02T00:00:00Z",
        },
      ],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listTransferRequests.useQuery = mockUseQuery;

    const { result } = renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.listTransferRequests.useQuery = mockUseQuery;

    const { result } = renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = {
      status: 500,
      message: "Failed to fetch transfer requests",
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.listTransferRequests.useQuery = mockUseQuery;

    const { result } = renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it("should handle empty transfer requests list", () => {
    const mockData = {
      status: 200,
      body: [],
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.listTransferRequests.useQuery = mockUseQuery;

    const { result } = renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.data?.body).toHaveLength(0);
  });

  it("should return the result of tsr query", () => {
    const mockQueryResult = {
      data: undefined,
      error: null,
      isLoading: true,
      refetch: vi.fn(),
    };

    mockTsr.experiments.listTransferRequests.useQuery = vi.fn().mockReturnValue(mockQueryResult);

    const { result } = renderHook(() => useTransferRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockQueryResult);
  });
});
