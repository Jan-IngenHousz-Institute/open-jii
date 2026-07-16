import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MockTransport } from "../testing/mock-transport";
import { createMockTransport } from "../testing/mock-transport";
import { AmbitDriver } from "./driver";

const HELLO_REPLY = "NEW Name Here Ready\n";

/** Reply table keyed by the exact payload sent; missing entries stay silent. */
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

/** Fast windows so quiet-window waits do not slow the suite down. */
function fastDriver(): AmbitDriver {
  return new AmbitDriver({ quietWindowMs: 20, timeoutMs: 500 });
}

describe("AmbitDriver", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("wakes the device during initialize and exposes the ambit family", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = fastDriver();
    await driver.initialize(transport);

    expect(driver.family).toBe("ambit");
    expect(vi.mocked(transport.send).mock.calls[0][0]).toBe("hello\n");
  });

  it("rejects protocol JSON with a command-cell hint", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = fastDriver();
    await driver.initialize(transport);

    const result = await driver.execute([{ set: [] }]);
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/command cell/);
  });

  it("parses the two-line get_par reply into par + channels", async () => {
    const transport = tableTransport({
      "hello\n": HELLO_REPLY,
      "get_par\n": ["123.4\n", "415,388,402,390,377,365,401,388,352,343\n"],
    });
    const driver = fastDriver();
    await driver.initialize(transport);

    const result = await driver.execute<{ par: number; channels: number[] }>("get_par");
    expect(result.success).toBe(true);
    expect(result.data?.par).toBeCloseTo(123.4);
    expect(result.data?.channels).toHaveLength(10);
  });

  it("parses the tab-separated temp reply", async () => {
    const transport = tableTransport({
      "hello\n": HELLO_REPLY,
      "temp\n": "23.1\t22.4\t23.0\n",
    });
    const driver = fastDriver();
    await driver.initialize(transport);

    const result = await driver.execute<Record<string, number>>("temp");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ objectC: 23.1, ambientC: 22.4, objectRawC: 23.0 });
  });

  it("treats a silent set_spec as fire + settle + hello re-verify, in one write", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = fastDriver();
    await driver.initialize(transport);

    const result = await driver.execute("set_spec,1.2340");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ acknowledged: "set_spec" });
    // Multi-arg command went out as ONE write (firmware arg timeouts are 10ms).
    expect(transport.send).toHaveBeenCalledWith("set_spec,1.2340\n");
  });

  it("fails a silent writer when the hello re-verify stays silent", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = fastDriver();
    await driver.initialize(transport);
    // After init, only set_name's verify hello goes unanswered.
    vi.mocked(transport.send).mockImplementation(() => Promise.resolve());

    const result = await driver.execute("set_name,bench-3");
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Response timeout|did not acknowledge/);
  });

  it("surfaces BAD COMMAND as a command error", async () => {
    const transport = tableTransport({
      "hello\n": HELLO_REPLY,
      "frobnicate\n": "BAD COMMAND\n",
    });
    const driver = fastDriver();
    await driver.initialize(transport);

    const result = await driver.execute("frobnicate");
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/rejected/);
  });

  it("strips non-ASCII idle bytes from replies", async () => {
    const transport = tableTransport({
      "hello\n": HELLO_REPLY,
      "check\n": "ÿOK sensors\n",
    });
    const driver = new AmbitDriver({ quietWindowMs: 20, timeoutMs: 500 });
    await driver.initialize(transport);

    const result = await driver.execute<string>("check", { timeoutMs: 500 });
    expect(result.success).toBe(true);
    expect(result.data).toBe("OK sensors");
  });

  it("getDeviceIdentity captures the name before the Ready sentinel", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = fastDriver();
    await driver.initialize(transport);

    const identity = await driver.getDeviceIdentity();
    expect(identity).toMatchObject({ family: "ambit", name: "NEW Name Here" });
  });

  it("times out with an error when a reply-carrying command stays silent", async () => {
    const transport = tableTransport({ "hello\n": HELLO_REPLY });
    const driver = new AmbitDriver({ quietWindowMs: 20, timeoutMs: 60 });
    await driver.initialize(transport);

    const result = await driver.execute("temp");
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Response timeout");
  });
});
