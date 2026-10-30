import { afterEach, describe, expect, it, vi } from "vitest";

import { identifyDevice } from "../core/identify-device";
import multispeqManifest from "../demo-sensors/multispeq/manifest.json";
import { getDemoRecording, simulatedDeviceId, SIMULATED_SENSOR_FAMILIES } from "./recordings";
import { SimulatedTransportAdapter } from "./transport";

afterEach(() => vi.useRealTimers());

describe("recorded sensor replay", () => {
  it.each(SIMULATED_SENSOR_FAMILIES)("reserves a distinct simulated identity for %s", (family) => {
    expect(simulatedDeviceId(family)).toBe(`simulated:${family}`);
  });

  it("refuses a recording with an unsupported manifest version", () => {
    const version = multispeqManifest.recordingVersion;
    try {
      multispeqManifest.recordingVersion = 2;
      expect(() => getDemoRecording("multispeq")).toThrow("Invalid demo sensor recording");
    } finally {
      multispeqManifest.recordingVersion = version;
    }
  });

  it("reports battery and disconnect status and refuses malformed commands", async () => {
    vi.useFakeTimers();
    const adapter = new SimulatedTransportAdapter("multispeq");
    const received = vi.fn();
    const status = vi.fn();
    adapter.onDataReceived(received);
    adapter.onStatusChanged(status);
    await expect(adapter.send("not-json")).rejects.toThrow("no demo recording");
    expect(received).not.toHaveBeenCalled();
    await adapter.send("battery");
    await vi.runAllTimersAsync();
    expect(received).toHaveBeenCalledWith(
      `${String(getDemoRecording("multispeq").measurement.device_battery)}\n`,
    );
    await adapter.disconnect();
    expect(status).toHaveBeenCalledWith(false);
    expect(adapter.isConnected()).toBe(false);
  });

  it.each(SIMULATED_SENSOR_FAMILIES)(
    "identifies and executes %s through its real driver",
    async (family) => {
      const adapter = new SimulatedTransportAdapter(family, 1);
      const { family: identifiedFamily, connector } = await identifyDevice(adapter);
      try {
        expect(identifiedFamily).toBe(family);
        const fixture = getDemoRecording(family);
        const result = await connector.execute(fixture.protocol);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(fixture.measurement);
        expect((await connector.execute(fixture.protocol)).data).toEqual(result.data);
        expect((await connector.execute([{ unsupported: true }])).success).toBe(false);
      } finally {
        await connector.destroy();
      }
      expect(adapter.isConnected()).toBe(false);
    },
  );

  it("returns independent recordings", () => {
    const first = getDemoRecording("multispeq");
    first.measurement.sample.length = 0;
    first.protocol.length = 0;
    expect(getDemoRecording("multispeq").measurement.sample).toHaveLength(1);
    expect(getDemoRecording("multispeq").protocol).toHaveLength(1);
  });

  it("cancels pending replies without contaminating the next run", async () => {
    vi.useFakeTimers();
    const adapter = new SimulatedTransportAdapter("multispeq");
    const received = vi.fn();
    adapter.onDataReceived(received);
    const command = JSON.stringify(getDemoRecording("multispeq").protocol);
    await adapter.send(command);
    await adapter.send("-1+");
    await vi.runAllTimersAsync();
    expect(received).not.toHaveBeenCalled();
    await adapter.send(command);
    await vi.runAllTimersAsync();
    expect(received).toHaveBeenCalledTimes(1);
    await adapter.send(command);
    await adapter.disconnect();
    await vi.runAllTimersAsync();
    expect(received).toHaveBeenCalledTimes(1);
    await expect(adapter.send(command)).rejects.toThrow("disconnected");
  });
});
