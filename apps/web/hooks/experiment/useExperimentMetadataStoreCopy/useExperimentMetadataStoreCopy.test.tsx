import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentMetadataStoreCopy } from "./useExperimentMetadataStoreCopy";

const metadataKey = orpc.experiments.listExperimentMetadata.queryKey({ input: { id: "exp-123" } });

describe("useExperimentMetadataStoreCopy", () => {
  it("asks for the sheet's store copy again", async () => {
    const spy = server.mount(contract.experiments.copyExperimentMetadataToStore);

    const { result } = renderHook(() => useExperimentMetadataStoreCopy());

    act(() => {
      result.current.mutate({ id: "exp-123", metadataId: "meta-1" });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-123");
      expect(spy.params.metadataId).toBe("meta-1");
    });
  });

  it.each([
    ["it was asked", 202],
    ["the request failed", 500],
  ])("refreshes the experiment's metadata list once %s", async (_, status) => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(metadataKey, []);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    server.mount(contract.experiments.copyExperimentMetadataToStore, { status });

    const { result } = renderHook(() => useExperimentMetadataStoreCopy(), { queryClient });

    act(() => {
      result.current.mutate({ id: "exp-123", metadataId: "meta-1" });
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: metadataKey });
    });
  });
});
