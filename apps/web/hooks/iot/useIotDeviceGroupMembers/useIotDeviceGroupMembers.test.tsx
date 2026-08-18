import { createDeviceGroupMember } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceGroupMembers } from "./useIotDeviceGroupMembers";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("useIotDeviceGroupMembers", () => {
  it("fetches the roster for the group", async () => {
    const spy = server.mount(contract.deviceGroups.listDeviceGroupMembers, {
      body: [createDeviceGroupMember(), createDeviceGroupMember()],
    });

    const { result } = renderHook(() => useIotDeviceGroupMembers(GROUP_ID));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(spy.params.groupId).toBe(GROUP_ID);
  });

  it("surfaces an error response", async () => {
    server.mount(contract.deviceGroups.listDeviceGroupMembers, { status: 500 });

    const { result } = renderHook(() => useIotDeviceGroupMembers(GROUP_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
