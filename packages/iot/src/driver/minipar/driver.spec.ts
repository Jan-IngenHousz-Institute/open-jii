import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MockTransport } from "../testing/mock-transport";
import { createMockTransport } from "../testing/mock-transport";
import { MiniParDriver } from "./driver";

const ENVELOPE = {
  device_name: "MiniPAR",
  device_version: "1.1",
  device_id: "AA:BB:CC:DD:EE:FF",
  device_battery: "NaN",
  device_firmware: 1.04,
  sample: [{ protocol_id: "NaN", set: [{ label: "par", par: 345.61 }] }],
};
const ENVELOPE_WIRE = `${JSON.stringify(ENVELOPE)}7A1E3AA1\n`;

function tableTransport(table: Partial<Record<string, string | string[]>>): MockTransport {
  const transport = createMockTransport();
  vi.mocked(transport.send).mockImplementation((payload: string) => {
    const reply = table[payload];
    if (reply !== undefined) {
      const chunks = Array.isArray(reply) ? reply : [reply];
      setTimeout(() => {
        for (const chunk of chunks) transport.simulateData(chunk);
      }, 0);
    }
    return Promise.resolve();
  });
  return transport;
}

describe("MiniParDriver", () => {
  let driver: MiniParDriver;

  beforeEach(() => {
    vi.useRealTimers();
    driver = new MiniParDriver({ timeoutMs: 500, protocolTimeoutMs: 500 });
  });

  it("exposes the minipar family", () => {
    expect(driver.family).toBe("minipar");
  });

  it("runs LINE commands and strips the firmware's blank-line echo", async () => {
    driver.initialize(tableTransport({ "par\n": "\n345.61\n" }));

    const result = await driver.execute<string>("par");
    expect(result.success).toBe(true);
    expect(result.data).toBe("345.61");
  });

  it("completes a newline-less LINE reply via the quiet window (hello)", async () => {
    driver.initialize(tableTransport({ "hello\n": "MiniPAR,1.1,1.04" }));

    const result = await driver.execute<string>("hello");
    expect(result.success).toBe(true);
    expect(result.data).toBe("MiniPAR,1.1,1.04");
  });

  it("surfaces error:* LINE replies as command errors", async () => {
    driver.initialize(tableTransport({ "spec_set_gain,99\n": "error:invalid_gain\n" }));

    const result = await driver.execute("spec_set_gain,99");
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/error:invalid_gain/);
  });

  it("sends a JSON protocol in one write and parses the footer-terminated envelope", async () => {
    const protocol = [{ set: [{ label: "par", protocol_repeats: 3 }] }];
    const transport = tableTransport({
      [`${JSON.stringify(protocol)}\n`]: ENVELOPE_WIRE,
    });
    driver.initialize(transport);

    const result = await driver.execute<typeof ENVELOPE>(protocol);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(ENVELOPE);
    expect(result.checksum).toBe("7A1E3AA1");
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it("reassembles an envelope delivered in chunks", async () => {
    const protocol = [{ set: [{ label: "par" }] }];
    const wire = ENVELOPE_WIRE;
    const transport = tableTransport({
      [`${JSON.stringify(protocol)}\n`]: [wire.slice(0, 40), wire.slice(40, 90), wire.slice(90)],
    });
    driver.initialize(transport);

    const result = await driver.execute<typeof ENVELOPE>(protocol);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(ENVELOPE);
  });

  it("keeps inline unknown_command errors inside the parsed envelope", async () => {
    const protocol = [{ set: [{ label: "frobnicate" }] }];
    const withError = {
      ...ENVELOPE,
      sample: [{ protocol_id: "NaN", set: [{ error: "unknown_command" }] }],
    };
    driver.initialize(
      tableTransport({
        [`${JSON.stringify(protocol)}\n`]: `${JSON.stringify(withError)}7A1E3AA1\n`,
      }),
    );

    const result = await driver.execute<typeof withError>(protocol);
    expect(result.success).toBe(true);
    expect(result.data?.sample[0]).toMatchObject({ set: [{ error: "unknown_command" }] });
  });

  it("times out when the device stays silent", async () => {
    driver.initialize(tableTransport({}));

    const result = await driver.execute("par", { timeoutMs: 60 });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Response timeout");
  });

  it("returns a partial LINE reply at the overall timeout", async () => {
    driver.initialize(tableTransport({ "par\n": "345.61" }));

    const result = await driver.execute<string>("par", { timeoutMs: 60 });
    expect(result).toEqual({ success: true, data: "345.61" });
  });

  it("reports a footer-terminated corrupt protocol envelope", async () => {
    const protocol = [{ set: [{ label: "par" }] }];
    driver.initialize(
      tableTransport({
        [`${JSON.stringify(protocol)}\n`]: "not-json7A1E3AA1\n",
      }),
    );

    const result = await driver.execute(protocol, { timeoutMs: 60 });
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/complete measurement envelope/);
  });

  it("getDeviceIdentity prefers the persisted name over the CSV product name", async () => {
    driver.initialize(
      tableTransport({
        "hello\n": "MiniPAR,1.1,1.04\n",
        "get_name\n": "Greenhouse PAR 7\n",
      }),
    );

    const identity = await driver.getDeviceIdentity();
    expect(identity).toMatchObject({
      family: "minipar",
      name: "Greenhouse PAR 7",
      firmwareVersion: "1.04",
    });
  });

  it("getDeviceIdentity falls back to MiniPAR when the persisted name is NoName", async () => {
    driver.initialize(
      tableTransport({
        "hello\n": "MiniPAR,1.1,1.04\n",
        "get_name\n": "NoName\n",
      }),
    );

    const identity = await driver.getDeviceIdentity();
    expect(identity.name).toBe("MiniPAR");
  });

  it("reads identity from the JSON hello form when no persisted name is available", async () => {
    driver.initialize(
      tableTransport({
        "hello\n": '{"device":"MiniPAR","version":"2.3"}\n',
        "get_name\n": "\n",
      }),
    );

    const identity = await driver.getDeviceIdentity();
    expect(identity).toMatchObject({
      family: "minipar",
      name: "MiniPAR",
      firmwareVersion: "2.3",
    });
  });

  it("clears buffered state and disconnects when destroyed", async () => {
    const transport = tableTransport({});
    driver.initialize(transport);

    await driver.destroy();

    expect(transport.disconnect).toHaveBeenCalledOnce();
    await expect(driver.execute("hello")).rejects.toThrow(/not initialized/);
  });
});
