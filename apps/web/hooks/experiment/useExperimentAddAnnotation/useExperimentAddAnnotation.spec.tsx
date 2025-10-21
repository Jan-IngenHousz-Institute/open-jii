/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useExperimentAddAnnotation } from "~/hooks/experiment/useExperimentAddAnnotation/useExperimentAddAnnotation";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      addAnnotation: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr;

describe("addExperimentAnnotation", () => {
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
  });

  it("should call useMutation with correct onSuccess handler", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.experiments.addAnnotation.useMutation as unknown) = mockUseMutation;

    renderHook(() => useExperimentAddAnnotation(), { wrapper: createWrapper() });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });
});
