import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeleteIotDeviceGroup } from "./useDeleteIotDeviceGroup";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("useDeleteIotDeviceGroup", () => {
  it("deletes the group and calls onSuccess", async () => {
    const spy = server.mount(contract.iot.deleteIotDeviceGroup, { status: 204 });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteIotDeviceGroup({ onSuccess }));

    act(() => {
      result.current.mutate({ groupId: GROUP_ID });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.calls).toHaveLength(1);
    expect(spy.params.groupId).toBe(GROUP_ID);
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.deleteIotDeviceGroup, { status: 403 });

    const { result } = renderHook(() => useDeleteIotDeviceGroup());

    act(() => {
      result.current.mutate({ groupId: GROUP_ID });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
