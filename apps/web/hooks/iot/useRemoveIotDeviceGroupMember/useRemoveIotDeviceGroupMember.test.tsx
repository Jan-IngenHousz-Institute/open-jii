import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useRemoveIotDeviceGroupMember } from "./useRemoveIotDeviceGroupMember";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("useRemoveIotDeviceGroupMember", () => {
  it("removes the member by group and device id", async () => {
    const spy = server.mount(contract.iot.removeIotDeviceGroupMember, { status: 204 });

    const { result } = renderHook(() => useRemoveIotDeviceGroupMember());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, deviceId: DEVICE_ID });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(spy.params.groupId).toBe(GROUP_ID);
    expect(spy.params.deviceId).toBe(DEVICE_ID);
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.removeIotDeviceGroupMember, { status: 403 });

    const { result } = renderHook(() => useRemoveIotDeviceGroupMember());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, deviceId: DEVICE_ID });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
