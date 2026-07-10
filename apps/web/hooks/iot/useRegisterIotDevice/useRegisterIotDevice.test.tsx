import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useRegisterIotDevice } from "./useRegisterIotDevice";

const body = { serialNumber: "E8:F6:0A:B1:1D:D4", deviceType: "ambyte", name: "Greenhouse 1" };

describe("useRegisterIotDevice", () => {
  it("sends the registration body", async () => {
    const spy = server.mount(contract.iot.registerIotDevice, { body: createIotDevice() });

    const { result } = renderHook(() => useRegisterIotDevice());

    act(() => {
      result.current.mutate({ body });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject(body);
    });
  });

  it("calls onSuccess with the created device", async () => {
    server.mount(contract.iot.registerIotDevice, { body: createIotDevice({ id: "new-1" }) });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegisterIotDevice({ onSuccess }));

    act(() => {
      result.current.mutate({ body });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "new-1" }));
    });
  });

  it("surfaces a conflict error", async () => {
    server.mount(contract.iot.registerIotDevice, { status: 409 });

    const { result } = renderHook(() => useRegisterIotDevice());

    act(() => {
      result.current.mutate({ body });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
