import { createIotDeviceGroup } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateIotDeviceGroupBody } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { useCreateIotDeviceGroup } from "./useCreateIotDeviceGroup";

const body: CreateIotDeviceGroupBody = {
  name: "Field campaign",
  description: "North plots",
};

describe("useCreateIotDeviceGroup", () => {
  it("sends the create body", async () => {
    const spy = server.mount(contract.iot.createIotDeviceGroup, {
      body: createIotDeviceGroup(),
    });

    const { result } = renderHook(() => useCreateIotDeviceGroup());

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject(body);
    });
  });

  it("calls onSuccess with the created group", async () => {
    server.mount(contract.iot.createIotDeviceGroup, {
      body: createIotDeviceGroup({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateIotDeviceGroup({ onSuccess }));

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "11111111-1111-4111-8111-111111111111" }),
      );
    });
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.createIotDeviceGroup, { status: 403 });

    const { result } = renderHook(() => useCreateIotDeviceGroup());

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
