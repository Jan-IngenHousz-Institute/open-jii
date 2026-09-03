import { createDeviceGroupDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceGroup } from "./useIotDeviceGroup";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("useIotDeviceGroup", () => {
  it("fetches the group detail by id", async () => {
    const spy = server.mount(contract.iot.getIotDeviceGroup, {
      body: createDeviceGroupDetail({ id: GROUP_ID }),
    });

    const { result } = renderHook(() => useIotDeviceGroup(GROUP_ID));

    await waitFor(() => {
      expect(result.current.data?.id).toBe(GROUP_ID);
    });
    expect(spy.params.groupId).toBe(GROUP_ID);
  });

  it("surfaces a not-found error", async () => {
    server.mount(contract.iot.getIotDeviceGroup, { status: 404 });

    const { result } = renderHook(() => useIotDeviceGroup(GROUP_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
