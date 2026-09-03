import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  BulkRegisterIotDevicesBody,
  BulkRegisterIotDevicesResult,
} from "@repo/api/domains/iot/iot.schema";

import { useBulkRegisterIotDevices } from "./useBulkRegisterIotDevices";

const body: BulkRegisterIotDevicesBody = {
  devices: [{ serialNumber: "E8:F6:0A:B1:1D:D4" }, { serialNumber: "E8:F6:0A:B1:1D:D5" }],
  deviceType: "ambyte",
};

const resultBody: BulkRegisterIotDevicesResult = {
  devices: [
    { serialNumber: "E8:F6:0A:B1:1D:D4", device: createIotDevice(), error: null },
    { serialNumber: "E8:F6:0A:B1:1D:D5", device: createIotDevice(), error: null },
  ],
  groupId: null,
  groupError: null,
};

describe("useBulkRegisterIotDevices", () => {
  it("sends the batch body", async () => {
    const spy = server.mount(contract.iot.bulkRegisterIotDevices, { body: resultBody });

    const { result } = renderHook(() => useBulkRegisterIotDevices());

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject(body);
    });
  });

  it("calls onSuccess with the batch result", async () => {
    server.mount(contract.iot.bulkRegisterIotDevices, { body: resultBody });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useBulkRegisterIotDevices({ onSuccess }));

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(resultBody);
    });
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.bulkRegisterIotDevices, { status: 403 });

    const { result } = renderHook(() => useBulkRegisterIotDevices());

    act(() => {
      result.current.mutate(body);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
