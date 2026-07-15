import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAILING_MOCK_DEVICE_INDEX,
  MockTransportAdapter,
  mockDevicesEnabled,
} from "./mock-devices";

describe("mockDevicesEnabled", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("is off without the query parameter", () => {
    expect(mockDevicesEnabled()).toBe(false);
  });

  it("turns on with ?mockDevices=1 outside production", () => {
    window.history.replaceState({}, "", "/?mockDevices=1");
    expect(mockDevicesEnabled()).toBe(true);
  });
});

describe("MockTransportAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function sendAndReceive(adapter: MockTransportAdapter, data: string): Promise<string> {
    let received = "";
    adapter.onDataReceived((chunk) => {
      received += chunk;
    });
    await adapter.send(data);
    await vi.runAllTimersAsync();
    return received;
  }

  it("answers a protocol with newline-terminated measurement JSON", async () => {
    const adapter = new MockTransportAdapter(2);

    const reply = await sendAndReceive(adapter, '[{"_protocol_set_":[]}]\n');

    expect(reply.endsWith("\n")).toBe(true);
    const measurement = JSON.parse(reply) as Record<string, unknown>;
    expect(measurement.device_id).toBe("mock-2");
    expect(measurement.device_name).toBe("Mock MultispeQ 2");
    expect(measurement).toHaveProperty("Fm_prime");
    expect(measurement).toHaveProperty("Fs");
    expect(Array.isArray(measurement.sample)).toBe(true);
  });

  it("answers console commands with a plain-text ready line", async () => {
    const adapter = new MockTransportAdapter(1);

    const reply = await sendAndReceive(adapter, "hello\n");

    expect(reply).toBe("MultispeQ Ready\n");
  });

  it("fails the flaky device's first protocol run, then succeeds", async () => {
    const adapter = new MockTransportAdapter(FAILING_MOCK_DEVICE_INDEX);

    await expect(adapter.send('[{"x":1}]')).rejects.toThrow("Mock device failure (simulated)");

    const reply = await sendAndReceive(adapter, '[{"x":1}]');
    expect((JSON.parse(reply) as Record<string, unknown>).device_id).toBe(
      `mock-${FAILING_MOCK_DEVICE_INDEX}`,
    );
  });

  it("reports disconnect through the status callback and rejects further sends", async () => {
    const adapter = new MockTransportAdapter(1);
    const status = vi.fn();
    adapter.onStatusChanged(status);
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();

    expect(adapter.isConnected()).toBe(false);
    expect(status).toHaveBeenCalledWith(false);
    await expect(adapter.send("hello")).rejects.toThrow("device not open");
  });
});
