import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceActivity } from "./useIotDeviceActivity";

describe("useIotDeviceActivity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling on an unattended page and refetches on the next input", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.iot.getIotDeviceActivity, { body: { lastDataAt: null } });

    const { result } = renderHook(() => useIotDeviceActivity("dev-1"));
    await waitFor(() => expect(result.current.data).toEqual({ lastDataAt: null }));

    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    const callsWhileIdle = spy.callCount;

    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(spy.callCount).toBe(callsWhileIdle);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    await waitFor(() => expect(spy.callCount).toBe(callsWhileIdle + 1));
  });

  it("fetches the device's last data arrival", async () => {
    const spy = server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: "2026-08-13T09:00:00.000Z" },
    });

    const { result } = renderHook(() => useIotDeviceActivity("dev-1"));

    await waitFor(() => {
      expect(result.current.data?.lastDataAt).toBe("2026-08-13T09:00:00.000Z");
    });
    expect(spy.params.deviceId).toBe("dev-1");
  });

  it("carries a null lastDataAt for a device that never landed data", async () => {
    server.mount(contract.iot.getIotDeviceActivity, { body: { lastDataAt: null } });

    const { result } = renderHook(() => useIotDeviceActivity("dev-2"));

    await waitFor(() => {
      expect(result.current.data).toEqual({ lastDataAt: null });
    });
  });
});
