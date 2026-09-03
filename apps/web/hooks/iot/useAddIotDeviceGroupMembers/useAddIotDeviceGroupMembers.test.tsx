import { createDeviceGroupMember } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useAddIotDeviceGroupMembers } from "./useAddIotDeviceGroupMembers";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("useAddIotDeviceGroupMembers", () => {
  it("sends the batch to the group's roster route", async () => {
    const spy = server.mount(contract.iot.addIotDeviceGroupMembers, {
      body: [createDeviceGroupMember({ deviceId: DEVICE_ID })],
    });

    const { result } = renderHook(() => useAddIotDeviceGroupMembers());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, deviceIds: [DEVICE_ID] });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ deviceIds: [DEVICE_ID] });
    });
    expect(spy.params.groupId).toBe(GROUP_ID);
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.addIotDeviceGroupMembers, { status: 403 });

    const { result } = renderHook(() => useAddIotDeviceGroupMembers());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, deviceIds: [DEVICE_ID] });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
