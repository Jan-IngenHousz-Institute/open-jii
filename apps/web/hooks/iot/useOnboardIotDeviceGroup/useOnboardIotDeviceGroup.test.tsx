import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useOnboardIotDeviceGroup } from "./useOnboardIotDeviceGroup";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("useOnboardIotDeviceGroup", () => {
  it("posts the batch and returns per-device outcomes", async () => {
    const spy = server.mount(contract.iot.onboardIotDeviceGroup, {
      body: { devices: [{ deviceId: DEVICE_ID, config: null, error: "boom" }] },
    });

    const { result } = renderHook(() => useOnboardIotDeviceGroup());

    act(() => {
      result.current.mutate({
        groupId: GROUP_ID,
        experimentIds: [],
        deviceIds: [DEVICE_ID],
        includeWorkbook: true,
      });
    });

    await waitFor(() => {
      expect(result.current.data?.devices).toHaveLength(1);
    });
    expect(spy.body).toMatchObject({ deviceIds: [DEVICE_ID], includeWorkbook: true });
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.onboardIotDeviceGroup, { status: 500 });

    const { result } = renderHook(() => useOnboardIotDeviceGroup());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, experimentIds: [], includeWorkbook: true });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
