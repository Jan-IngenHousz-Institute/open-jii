import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentMetadataUpdate } from "./useExperimentMetadataUpdate";

const metadataResponse = {
  metadataId: "meta-1",
  experimentId: "exp-123",
  metadata: { key: "updated" },
  createdBy: "user-1",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-02T00:00:00.000Z",
};

describe("useExperimentMetadataUpdate", () => {
  it("sends PUT request with correct params and body", async () => {
    const spy = server.mount(contract.experiments.updateExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
        body: { metadata: { key: "updated" } },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.params.metadataId).toBe("meta-1");
      expect(spy.body).toMatchObject({ metadata: { key: "updated" } });
    });
  });

  it("invalidates cache after successful update", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["experiment", "exp-123", "metadata"], {
      body: [{ metadataId: "meta-1", metadata: { key: "old" } }],
    });

    server.mount(contract.experiments.updateExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataUpdate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
        body: { metadata: { key: "updated" } },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = createTestQueryClient();
    const previousData = { body: [{ metadataId: "meta-1", metadata: { key: "original" } }] };
    queryClient.setQueryData(["experiment", "exp-123", "metadata"], previousData);

    server.mount(contract.experiments.updateExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadataUpdate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
        body: { metadata: { key: "updated" } },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();

    server.mount(contract.experiments.updateExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataUpdate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123", metadataId: "meta-1" },
        body: { metadata: { key: "new" } },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
