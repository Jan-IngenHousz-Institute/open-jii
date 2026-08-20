import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useIssueIotDeviceGroupCredentials } from "./useIssueIotDeviceGroupCredentials";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("useIssueIotDeviceGroupCredentials", () => {
  it("posts the batch and returns per-device credential rows", async () => {
    const spy = server.mount(contract.iot.issueIotDeviceGroupCredentials, {
      body: {
        devices: [{ deviceId: DEVICE_ID, thingName: null, credentials: null, error: "boom" }],
      },
    });

    const { result } = renderHook(() => useIssueIotDeviceGroupCredentials());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID, deviceIds: [DEVICE_ID] });
    });

    await waitFor(() => {
      expect(result.current.data?.devices).toHaveLength(1);
    });
    expect(spy.body).toMatchObject({ deviceIds: [DEVICE_ID] });
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.issueIotDeviceGroupCredentials, { status: 500 });

    const { result } = renderHook(() => useIssueIotDeviceGroupCredentials());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
