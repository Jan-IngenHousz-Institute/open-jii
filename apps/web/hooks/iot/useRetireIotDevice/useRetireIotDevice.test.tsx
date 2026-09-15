import { orpc } from "@/lib/orpc";
import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useRetireIotDevice } from "./useRetireIotDevice";

describe("useRetireIotDevice", () => {
  it("retires by device id and calls onSuccess", async () => {
    const spy = server.mount(contract.iot.retireIotDevice, { body: createIotDevice() });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRetireIotDevice({ onSuccess }));

    act(() => {
      result.current.mutate({ deviceId: "dev-9" });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.params.deviceId).toBe("dev-9");
  });

  it("refreshes every roster that shows the device's status", async () => {
    server.mount(contract.iot.retireIotDevice, { body: createIotDevice() });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRetireIotDevice(), { queryClient });

    act(() => {
      result.current.mutate({ deviceId: "dev-9" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: orpc.iot.listIotDevices.key() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orpc.iot.getIotDevice.key() });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.iot.listIotDeviceGroupMembers.key(),
    });
  });

  it("surfaces a refused transition", async () => {
    server.mount(contract.iot.retireIotDevice, { status: 400 });

    const { result } = renderHook(() => useRetireIotDevice());

    act(() => {
      result.current.mutate({ deviceId: "dev-9" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
