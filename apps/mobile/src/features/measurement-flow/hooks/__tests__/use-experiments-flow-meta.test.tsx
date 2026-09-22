import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { useExperimentsFlowMeta } from "../use-experiments-flow-meta";

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      getFlow: {
        queryOptions: (options: { input: { id: string }; meta?: Record<string, unknown> }) => ({
          queryKey: ["experiment-flow", options.input.id],
          queryFn: () =>
            Promise.reject(Object.assign(new Error("Flow not found"), { status: 404 })),
          retry: false,
          networkMode: "always" as const,
          ...options,
        }),
      },
    },
  },
}));

describe("useExperimentsFlowMeta", () => {
  it("does not surface errors from optional picker-card metadata requests", async () => {
    const surfacedErrors: Error[] = [];
    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (!query.meta?.suppressToast) surfacedErrors.push(error);
        },
      }),
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useExperimentsFlowMeta(["experiment-1", "experiment-2"]), { wrapper });

    await waitFor(() => {
      expect(
        queryClient
          .getQueryCache()
          .findAll()
          .map((query) => query.state.status),
      ).toEqual(["error", "error"]);
    });
    expect(surfacedErrors).toEqual([]);
  });
});
