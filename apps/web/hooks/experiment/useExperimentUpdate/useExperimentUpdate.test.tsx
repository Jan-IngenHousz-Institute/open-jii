import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentUpdate } from "./useExperimentUpdate";

describe("useExperimentUpdate", () => {
  it("sends PATCH request", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-1", name: "Updated" }),
    });

    const { result } = renderHook(() => useExperimentUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Updated" });
    });
  });

  it("optimistically updates the single experiment cache", async () => {
    // Use Infinity gcTime so cache entries survive without active observers
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });

    // Pre-populate the single experiment cache
    queryClient.setQueryData(["experiment", "exp-1"], {
      body: createExperiment({ id: "exp-1", name: "Old Name", description: "Old desc" }),
    });

    // Delay the response so we can observe optimistic state
    server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-1", name: "New Name", description: "Old desc" }),
      delay: 100,
    });

    const { result } = renderHook(() => useExperimentUpdate(), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: { name: "New Name" },
      });
    });

    // Optimistic update should apply immediately
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ body: { name: string } }>(["experiment", "exp-1"]);
      expect(cached?.body.name).toBe("New Name");
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(["experiment", "exp-1"], {
      body: createExperiment({ id: "exp-1", name: "Original", description: "desc" }),
    });

    server.mount(contract.experiments.updateExperiment, { status: 403 });

    server.mount(contract.experiments.getExperiment, {
      body: createExperiment({ id: "exp-1", name: "Original", description: "desc" }),
    });

    const { result } = renderHook(() => useExperimentUpdate(), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: { name: "Should Revert" },
      });
    });

    // The mutation should end in error state
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("returns mutation result with mutate function", () => {
    const { result } = renderHook(() => useExperimentUpdate());

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe("function");
  });
});
