/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

    // Both should have resolved independently
    expect(r1.current.isLoading).toBe(false);
    expect(r2.current.isLoading).toBe(false);
  });
});
