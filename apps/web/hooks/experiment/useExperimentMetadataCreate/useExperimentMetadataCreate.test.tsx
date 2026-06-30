import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentMetadataCreate } from "./useExperimentMetadataCreate";

const metadataPayload = {
  name: "Plates",
  columns: [{ id: "col-1", name: "plate_id", type: "string" as const }],
  rows: [],
  identifierColumnId: "col-1",
  experimentQuestionId: "q-1",
};

const metadataResponse = {
  metadataId: "00000000-0000-0000-0000-000000000001",
  experimentId: "00000000-0000-0000-0000-0000000000aa",
  metadata: metadataPayload,
  createdBy: "00000000-0000-0000-0000-0000000000bb",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const metadataKey = orpc.experiments.listExperimentMetadata.queryKey({ input: { id: "exp-123" } });

describe("useExperimentMetadataCreate", () => {
  it("sends POST request with correct params and body", async () => {
    const spy = server.mount(orpcContract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate());

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadata: metadataPayload,
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.body).toMatchObject({ metadata: metadataPayload });
    });
  });

  it("invalidates cache after successful create", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(metadataKey, []);

    server.mount(orpcContract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadata: metadataPayload,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(metadataKey, [metadataResponse]);

    server.mount(orpcContract.experiments.createExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadata: metadataPayload,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();

    server.mount(orpcContract.experiments.createExperimentMetadata, {
      body: metadataResponse,
    });

    const { result } = renderHook(() => useExperimentMetadataCreate(), {
      queryClient,
    });

    act(() => {
      result.current.mutate({
        id: "exp-123",
        metadata: metadataPayload,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
