import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAILING_MOCK_DEVICE_INDEX,
  MockTransportAdapter,
  mockDevicesEnabled,
  parseMockFamilies,
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

describe("parseMockFamilies", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("defaults to a single multispeq for bare ?mockDevices=1", () => {
    window.history.replaceState({}, "", "/?mockDevices=1");
    expect(parseMockFamilies()).toEqual(["multispeq"]);
  });

  it("parses a comma-separated family list, dropping unknown entries", () => {
    window.history.replaceState({}, "", "/?mockDevices=multispeq,ambit,minipar,ambyte,junk");
    expect(parseMockFamilies()).toEqual(["multispeq", "ambit", "minipar"]);
  });
});

describe("per-family mock replies", () => {
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

  it("multispeq answers device_info with identity JSON", async () => {
    const adapter = new MockTransportAdapter(2, "multispeq");
    const reply = await sendAndReceive(adapter, "device_info\r\n");
    const info = JSON.parse(reply) as Record<string, unknown>;
    expect(info.device_name).toBe("Mock MultispeQ 2");
    expect(info.device_id).toBe("mock-2");
    expect(info.device_firmware).toBe("2.311-mock");
  });

  it("ambit answers hello with the NEW ... Ready sentinel and stays silent on writers", async () => {
    const adapter = new MockTransportAdapter(1, "ambit");
    expect(await sendAndReceive(adapter, "hello\r\n")).toBe("NEW Mock Ambit 1 Ready\n");
    expect(await sendAndReceive(adapter, "set_spec,1.234\n")).toBe("");
    expect(await sendAndReceive(adapter, "frobnicate\n")).toBe("BAD COMMAND\n");
  });

  it("ambit answers get_par with the two-line PAR + channels reply", async () => {
    const adapter = new MockTransportAdapter(1, "ambit");
    const reply = await sendAndReceive(adapter, "get_par\n");
    const [par, channels] = reply.trim().split("\n");
    expect(Number(par)).toBeCloseTo(121);
    expect(channels.split(",")).toHaveLength(10);
  });

  it("minipar answers hello without a trailing newline, like the firmware", async () => {
    const adapter = new MockTransportAdapter(1, "minipar");
    const reply = await sendAndReceive(adapter, "hello\n");
    expect(reply).toBe('{"device":"MiniPAR","version":"1.1"}');
  });

  it("minipar answers protocol JSON with the envelope plus 7A1E3AA1 footer", async () => {
    const adapter = new MockTransportAdapter(2, "minipar");
    const reply = await sendAndReceive(adapter, '[{"set":[{"label":"par"}]}]\n');
    expect(reply.trimEnd().endsWith("7A1E3AA1")).toBe(true);
    const envelope = JSON.parse(reply.trimEnd().slice(0, -8)) as Record<string, unknown>;
    expect(envelope.device_name).toBe("Mock MiniPAR 2");
  });

  it("only the multispeq flaky index simulates a failure", async () => {
    const ambit = new MockTransportAdapter(FAILING_MOCK_DEVICE_INDEX, "ambit");
    await expect(ambit.send("hello\n")).resolves.toBeUndefined();
  });
});
