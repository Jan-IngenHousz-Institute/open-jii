import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeleteIotDevice } from "./useDeleteIotDevice";

describe("useDeleteIotDevice", () => {
  it("deletes by device id and calls onSuccess", async () => {
    const spy = server.mount(contract.iot.deleteIotDevice, { status: 204 });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteIotDevice({ onSuccess }));

    act(() => {
      result.current.mutate({ params: { deviceId: "dev-9" } });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.params.deviceId).toBe("dev-9");
  });

  it("surfaces a not-found error", async () => {
    server.mount(contract.iot.deleteIotDevice, { status: 404 });

    const { result } = renderHook(() => useDeleteIotDevice());

    act(() => {
      result.current.mutate({ params: { deviceId: "missing" } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
