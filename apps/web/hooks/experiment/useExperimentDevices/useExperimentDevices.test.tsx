import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDevices } from "./useExperimentDevices";

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";

const device = createIotDevice({ name: "Field Gateway" });

const overview = {
  devices: [
    {
      device: {
        id: device.id,
        thingName: device.thingName,
        serialNumber: device.serialNumber,
        name: device.name,
        deviceType: device.deviceType,
        status: device.status,
      },
      clientId: device.thingName,
      binding: {
        addedBy: "22222222-2222-4222-8222-222222222222",
        addedAt: new Date().toISOString(),
      },
      connectivity: null,
      lastDataAt: null,
      recentData: null,
      canView: true,
    },
  ],
  window: { from: "2026-08-04T12:00:00.000Z", to: "2026-09-03T12:00:00.000Z" },
  pipelineUnavailable: false,
};

describe("useExperimentDevices", () => {
  it("fetches the devices overview of an experiment", async () => {
    server.mount(contract.experiments.listExperimentDevices, { body: overview });

    const { result } = renderHook(() => useExperimentDevices(EXPERIMENT_ID));

    await waitFor(() => {
      expect(result.current.data?.devices).toHaveLength(1);
    });
    expect(result.current.data?.devices[0].device?.name).toBe("Field Gateway");
  });

  it("surfaces an error response", async () => {
    server.mount(contract.experiments.listExperimentDevices, { status: 403 });

    const { result } = renderHook(() => useExperimentDevices(EXPERIMENT_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
