import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDeviceRemove } from "./useExperimentDeviceRemove";

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("useExperimentDeviceRemove", () => {
  it("invalidates both sides of the binding after a detach", async () => {
    server.mount(contract.experiments.removeExperimentDevice, { status: 204, body: undefined });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDeviceRemove({ onSuccess }), { queryClient });
    result.current.mutate({ id: EXPERIMENT_ID, deviceId: DEVICE_ID });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.experiments.listExperimentDevices.queryKey({ input: { id: EXPERIMENT_ID } }),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.iot.listDeviceExperiments.queryKey({ input: { deviceId: DEVICE_ID } }),
    });
  });

  it("surfaces a failed detach", async () => {
    server.mount(contract.experiments.removeExperimentDevice, {
      status: 403,
      body: { message: "Nope" },
    });

    const { result } = renderHook(() => useExperimentDeviceRemove());
    result.current.mutate({ id: EXPERIMENT_ID, deviceId: DEVICE_ID });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
