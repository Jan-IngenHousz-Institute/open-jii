import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeleteIotDevice } from "./useDeleteIotDevice";

describe("useDeleteIotDevice", () => {
  it("deletes by device id and calls onSuccess", async () => {
    const spy = server.mount(contract.iot.deleteIotDevice, { status: 204 });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteIotDevice({ onSuccess }));

    act(() => {
      result.current.mutate({ deviceId: "dev-9" });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.params.deviceId).toBe("dev-9");
  });

  it("invalidates both binding lists, which the delete cascades away", async () => {
    server.mount(contract.iot.deleteIotDevice, { status: 204 });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteIotDevice(), { queryClient });

    act(() => {
      result.current.mutate({ deviceId: "dev-9" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.experiments.listExperimentDevices.key(),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.iot.listDeviceExperiments.key(),
    });
  });

  it("surfaces a not-found error", async () => {
    server.mount(contract.iot.deleteIotDevice, { status: 404 });

    const { result } = renderHook(() => useDeleteIotDevice());

    act(() => {
      result.current.mutate({ deviceId: "missing" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
