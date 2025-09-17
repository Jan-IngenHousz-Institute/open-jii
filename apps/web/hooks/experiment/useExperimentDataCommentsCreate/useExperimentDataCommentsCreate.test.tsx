/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentDataCommentsCreate } from "./useExperimentDataCommentsCreate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      createExperimentDataComments: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr;

describe("createExperimentDataComments", () => {
  let queryClient: QueryClient;
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

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

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient.mockReturnValue(
      mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>,
    );
  });

  it("should call useMutation with correct onSuccess handler", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.experiments.createExperimentDataComments.useMutation as unknown) = mockUseMutation;

    renderHook(() => useExperimentDataCommentsCreate(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });
});
