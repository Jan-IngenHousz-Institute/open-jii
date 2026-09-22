import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useRevokeExperimentJoinCode } from "./useRevokeExperimentJoinCode";

const EXPERIMENT_ID = "22222222-2222-2222-2222-222222222222";

describe("useRevokeExperimentJoinCode", () => {
  it("invalidates the get key for that experiment on settle", async () => {
    const spy = server.mount(contract.experiments.revokeJoinCode);
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRevokeExperimentJoinCode(), { queryClient });
    result.current.mutate({ id: EXPERIMENT_ID });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy.params.id).toBe(EXPERIMENT_ID);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: orpc.experiments.getJoinCode.key({ input: { id: EXPERIMENT_ID } }),
      }),
    );
    // No success toast: a toast mounts a Radix dismissable layer, which takes the
    // next Escape away from the dialog this mutation runs inside.
    expect(toast).not.toHaveBeenCalled();
  });

  it("falls back to the generic message when the server sends none", async () => {
    server.mount(contract.experiments.revokeJoinCode, { status: 500, body: {} });

    const { result } = renderHook(() => useRevokeExperimentJoinCode());
    result.current.mutate({ id: EXPERIMENT_ID });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "joinCode.revokeFailed",
      variant: "destructive",
    });
  });
});
