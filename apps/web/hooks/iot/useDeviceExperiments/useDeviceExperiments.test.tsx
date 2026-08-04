import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeviceExperiments } from "./useDeviceExperiments";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const binding = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Corn Photosynthesis",
  status: "active" as const,
  addedAt: new Date().toISOString(),
};

describe("useDeviceExperiments", () => {
  it("fetches the experiments a device serves", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [binding] });

    const { result } = renderHook(() => useDeviceExperiments(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0].name).toBe("Corn Photosynthesis");
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.listDeviceExperiments, { status: 403 });

    const { result } = renderHook(() => useDeviceExperiments(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
