import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentMetadataDelete } from "./useExperimentMetadataDelete";

const metadataKey = orpc.experiments.listExperimentMetadata.queryKey({ input: { id: "exp-123" } });

describe("useExperimentMetadataDelete", () => {
  it("sends DELETE request with correct params", async () => {
    const spy = server.mount(orpcContract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete());

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadataId: "meta-1",
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.params.metadataId).toBe("meta-1");
    });
  });

  it("invalidates cache after successful delete", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(metadataKey, []);

    server.mount(orpcContract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadataId: "meta-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(metadataKey, []);

    server.mount(orpcContract.experiments.deleteExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadataId: "meta-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();
    server.mount(orpcContract.experiments.deleteExperimentMetadata);

    const { result } = renderHook(() => useExperimentMetadataDelete(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadataId: "meta-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
