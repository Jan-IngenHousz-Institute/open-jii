/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentAnnotationAddBulk } from "./useExperimentAnnotationAddBulk";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      addAnnotationsBulk: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentAnnotationAddBulk", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockInvalidateQueries = vi.fn();
    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);
  });

  it("should return mutation from tsr", () => {
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
    };

    mockTsr.experiments.addAnnotationsBulk.useMutation = vi
      .fn()
      .mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAddBulk(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutation);
    expect(mockTsr.experiments.addAnnotationsBulk.useMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });

  it("should handle successful bulk annotation creation", () => {
    const mockData = { rowsAffected: 5 };
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: mockData,
      error: null,
    };

    mockTsr.experiments.addAnnotationsBulk.useMutation = vi
      .fn()
      .mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAddBulk(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe(mockData);
  });

  it("should handle mutation errors gracefully", () => {
    const mockError = new Error("Bulk add annotations failed");
    const mockMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: mockError,
    };

    mockTsr.experiments.addAnnotationsBulk.useMutation = vi
      .fn()
      .mockReturnValue(mockMutation) as any;

    const { result } = renderHook(() => useExperimentAnnotationAddBulk(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(mockError);
  });
});
