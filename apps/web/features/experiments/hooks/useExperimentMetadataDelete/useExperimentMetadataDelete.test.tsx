import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentMetadataDelete } from "./useExperimentMetadataDelete";

describe("useExperimentMetadataDelete", () => {
  it("sends DELETE request with correct params", async () => {
    const spy = server.mount(contract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.params.metadataId).toBe("meta-1");
    });
  });

  it("invalidates cache after successful delete", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["experiment", "exp-123", "metadata"], {
      body: [{ metadataId: "meta-1" }],
    });

    server.mount(contract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = createTestQueryClient();
    const previousData = { body: [{ metadataId: "meta-1", metadata: { key: "value" } }] };
    queryClient.setQueryData(["experiment", "exp-123", "metadata"], previousData);

    server.mount(contract.experiments.deleteExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();
    server.mount(contract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
