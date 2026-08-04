import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useOnboardDevice } from "./useOnboardDevice";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const EXPERIMENT_ID = "22222222-2222-4222-8222-222222222222";

const config = {
  thingName: "seed-ambyte-gw-01",
  deviceType: "ambyte" as const,
  endpoint: "abc-ats.iot.eu-central-1.amazonaws.com",
  experiments: [],
};

describe("useOnboardDevice", () => {
  it("invalidates the device's experiments and each affected experiment's devices", async () => {
    server.mount(contract.iot.onboardDevice, { body: config });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useOnboardDevice(), { queryClient });
    result.current.mutate({ deviceId: DEVICE_ID, experimentIds: [EXPERIMENT_ID] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.iot.listDeviceExperiments.queryKey({ input: { deviceId: DEVICE_ID } }),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.experiments.listExperimentDevices.queryKey({ input: { id: EXPERIMENT_ID } }),
    });
  });

  it("returns the issued config", async () => {
    server.mount(contract.iot.onboardDevice, { body: config });

    const { result } = renderHook(() => useOnboardDevice());
    result.current.mutate({ deviceId: DEVICE_ID, experimentIds: [] });

    await waitFor(() => {
      expect(result.current.data?.endpoint).toBe(config.endpoint);
    });
  });
});
