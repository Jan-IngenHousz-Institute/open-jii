import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Logger } from "../../utils/logger/logger";
import type { CommandProgress } from "../driver-base";
import type { MockTransport } from "../testing/mock-transport";
import { createMockTransport } from "../testing/mock-transport";
import { MULTISPEQ_FRAMING } from "./config";
import { MultispeqDriver } from "./driver";

const TIMEOUT = MULTISPEQ_FRAMING.DEFAULT_TIMEOUT;

let driver: MultispeqDriver;
let transport: MockTransport;
let logger: Logger;

beforeEach(() => {
  logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  driver = new MultispeqDriver(logger);
  transport = createMockTransport();
  driver.initialize(transport);
});

/** Make the next send() reply with `chunks`, delivered asynchronously. */
function replyWith(...chunks: string[]) {
  vi.mocked(transport.send).mockImplementation(() => {
    setTimeout(() => {
      for (const chunk of chunks) transport.simulateData(chunk);
    }, 0);
    return Promise.resolve();
  });
}

/**
 * The mobile app's bridge logger pattern-matches these messages and fields
 * (see apps/mobile driver-command-executor createBridgeLogger). They are a
 * compatibility contract: renaming them breaks command tracing and progress.
 */
describe("MultispeqDriver log contract", () => {
  it.each([
    {
      name: '"tx" with command and timeoutMs fields',
      cmd: "test-cmd",
      chunks: ['{"ok":1}ABCD1234\n'],
      calls: [["tx", { command: "test-cmd", timeoutMs: TIMEOUT }]],
    },
    {
      name: '"rx chunk" with a chars field per fragment',
      cmd: "cmd",
      chunks: ['{"va', 'lue":7}', "ABCD1234\n"],
      calls: [
        ["rx chunk", { chars: 4, buffered: 4 }],
        ["rx chunk", { chars: 7, buffered: 11 }],
        ["rx chunk", { chars: 9, buffered: 20 }],
      ],
    },
    {
      name: '"rx complete" with chars and checksum fields',
      cmd: "cmd",
      chunks: ['{"value":42}ABCD1234\n'],
      calls: [["rx complete", { chars: 20, checksum: "ABCD1234" }]],
    },
    {
      name: '"rx complete" with checksum "none" for plain-text replies',
      cmd: "battery",
      chunks: ["battery:85\n"],
      calls: [["rx complete", { chars: 10, checksum: "none" }]],
    },
    {
      name: '"command completed" with elapsedMs and timeoutMs fields',
      cmd: "cmd",
      chunks: ['{"ok":1}ABCD1234\n'],
      calls: [
        ["command completed", { elapsedMs: expect.any(Number) as number, timeoutMs: TIMEOUT }],
      ],
    },
  ])("emits debug $name", async ({ cmd, chunks, calls }) => {
    replyWith(...chunks);

    await driver.execute(cmd);

    for (const [message, fields] of calls) {
      expect(logger.debug).toHaveBeenCalledWith(message, fields);
    }
  });

  it('emits warn "command failed" with elapsedMs and err fields on transport error', async () => {
    vi.mocked(transport.send).mockRejectedValue(new Error("Send failed"));

    await driver.execute("cmd");

    expect(logger.warn).toHaveBeenCalledWith("command failed", {
      elapsedMs: expect.any(Number) as number,
      err: "Send failed",
    });
  });

  it('emits warn "response timeout, sending cancel" with a timeoutMs field on timeout', async () => {
    vi.useFakeTimers();
    try {
      const resultPromise = driver.execute("cmd");
      await vi.advanceTimersByTimeAsync(TIMEOUT + 1);
      await resultPromise;

      expect(logger.warn).toHaveBeenCalledWith("response timeout, sending cancel", {
        timeoutMs: TIMEOUT,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits debug "cancel: aborting in-flight command" when cancelling', async () => {
    const resultPromise = driver.execute("cmd");
    await Promise.resolve();
    await Promise.resolve();

    await driver.cancel();
    await resultPromise;

    expect(logger.debug).toHaveBeenCalledWith("cancel: aborting in-flight command");
  });

  it("summarizes long commands in the tx log", async () => {
    replyWith('{"ok":1}ABCD1234\n');

    await driver.execute("x".repeat(500));

    const txCall = vi.mocked(logger.debug).mock.calls.find(([msg]) => msg === "tx");
    const fields = txCall?.[1] as { command: string };
    expect(fields.command.length).toBeLessThan(200);
    expect(fields.command).toContain("(500 chars)");
  });
});

describe("MultispeqDriver getDeviceIdentity", () => {
  it("maps battery and hello replies onto a DeviceIdentity; omits fields when silent", async () => {
    let callCount = 0;
    vi.mocked(transport.send).mockImplementation(() => {
      callCount++;
      const reply = callCount === 1 ? "battery:88\n" : "MSQ-Device\n";
      setTimeout(() => transport.simulateData(reply), 0);
      return Promise.resolve();
    });
    const identity = await driver.getDeviceIdentity();
    expect(identity).toEqual({
      family: "multispeq",
      name: "MSQ-Device",
      batteryPercent: 88,
      raw: { device_battery: 88, device_name: "MSQ-Device" },
    });

    vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));
    const silent = await driver.getDeviceIdentity();
    expect(silent.family).toBe("multispeq");
    expect(silent.name).toBeUndefined();
    expect(silent.batteryPercent).toBeUndefined();
    expect(silent.raw).toEqual({});
  });
});

describe("MultispeqDriver progress emissions", () => {
  it('emits "sent" then a throttled "receiving" stream; unsubscribed listeners stay silent', async () => {
    vi.useFakeTimers();
    try {
      replyWith('{"va', 'lue":7}', "ABCD1234\n");
      const events: CommandProgress[] = [];
      driver.onProgress((p) => events.push(p));
      const unsubscribed: CommandProgress[] = [];
      driver.onProgress((p) => unsubscribed.push(p))();

      const resultPromise = driver.execute("cmd");
      await vi.advanceTimersByTimeAsync(1);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      // Chunks 2 and 3 land inside the throttle window (frozen clock), so
      // only the phase edges emit: "sent" and the first rx chunk.
      expect(events.map((e) => e.phase)).toEqual(["sent", "receiving"]);
      expect(events[0]).toMatchObject({ chunks: 0, bytes: 0 });
      expect(events[1]).toMatchObject({ chunks: 1, bytes: 4 });
      expect(events[1]?.lastEventAt).toBeGreaterThan(0);
      expect(unsubscribed).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
