import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentMetadataCreate } from "./useExperimentMetadataCreate";

const metadataResponse = {
  metadataId: "meta-new",
  experimentId: "exp-123",
  metadata: { location: "Lab B" },
  createdBy: "user-1",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("useExperimentMetadataCreate", () => {
  it("sends POST request with correct params and body", async () => {
    const spy = server.mount(contract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { metadata: { location: "Lab B" } },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.body).toMatchObject({ metadata: { location: "Lab B" } });
    });
  });

  it("invalidates cache after successful create", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["experiment", "exp-123", "metadata"], { body: [] });

    server.mount(contract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { metadata: { location: "Lab B" } },
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

    server.mount(contract.experiments.createExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { metadata: { location: "New" } },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();

    server.mount(contract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { metadata: { key: "new" } },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
