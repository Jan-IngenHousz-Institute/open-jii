import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useCreateExperimentJoinCode } from "./useCreateExperimentJoinCode";

const EXPERIMENT_ID = "22222222-2222-2222-2222-222222222222";

const CODE = {
  id: "11111111-1111-1111-1111-111111111111",
  experimentId: EXPERIMENT_ID,
  code: "KP7Q4WMX",
  expiresAt: "2026-09-25T00:00:00.000Z",
  redemptionCount: 0,
  createdAt: "2026-09-18T00:00:00.000Z",
  createdBy: null,
};

describe("useCreateExperimentJoinCode", () => {
  it("sends the selected expiry in the request body", async () => {
    const spy = server.mount(contract.experiments.createJoinCode, { body: CODE });

    const { result } = renderHook(() => useCreateExperimentJoinCode());
    result.current.mutate({ id: EXPERIMENT_ID, expiresIn: "30d" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The request body, not a spy on the hook: a field dropped between the card
    // and the wire still satisfies a call-argument assertion.
    expect(spy.body).toMatchObject({ expiresIn: "30d" });
    expect(spy.params.id).toBe(EXPERIMENT_ID);
  });

  it("invalidates the get key for that experiment on settle", async () => {
    server.mount(contract.experiments.createJoinCode, { body: CODE });
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateExperimentJoinCode(), { queryClient });
    result.current.mutate({ id: EXPERIMENT_ID, expiresIn: "7d" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: orpc.experiments.getJoinCode.key({ input: { id: EXPERIMENT_ID } }),
      }),
    );
    expect(toast).toHaveBeenCalledWith({ description: "joinCode.created" });
  });

  it("surfaces the server message on failure", async () => {
    server.mount(contract.experiments.createJoinCode, {
      status: 403,
      body: { message: "Join codes are only available for public experiments" },
    });

    const { result } = renderHook(() => useCreateExperimentJoinCode());
    result.current.mutate({ id: EXPERIMENT_ID, expiresIn: "7d" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "Join codes are only available for public experiments",
      variant: "destructive",
    });
  });
});
