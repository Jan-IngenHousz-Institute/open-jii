import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import type { CommandProgress } from "../driver-base";
import { MULTISPEQ_FRAMING } from "./config";
import { MultispeqDriver } from "./driver";

function createMockTransport(): ITransportAdapter & {
  simulateData: (data: string) => void;
} {
  let dataCallback: ((data: string) => void) | undefined;

  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulateData(data: string) {
      dataCallback?.(data);
    },
  };
}

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * The mobile app's bridge logger pattern-matches these messages and fields
 * (see apps/mobile driver-command-executor createBridgeLogger). They are a
 * compatibility contract: renaming them breaks command tracing and progress.
 */
describe("MultispeqDriver log contract", () => {
  let driver: MultispeqDriver;
  let transport: ReturnType<typeof createMockTransport>;
  let logger: Logger;

  beforeEach(() => {
    logger = createMockLogger();
    driver = new MultispeqDriver(logger);
    transport = createMockTransport();
    driver.initialize(transport);
  });

  it('emits debug "tx" with command and timeoutMs fields', async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"ok":1}ABCD1234\n'), 0);
      return Promise.resolve();
    });

    await driver.execute("test-cmd");

    expect(logger.debug).toHaveBeenCalledWith("tx", {
      command: "test-cmd",
      timeoutMs: MULTISPEQ_FRAMING.DEFAULT_TIMEOUT,
    });
  });

  it('emits debug "rx chunk" with a chars field per fragment', async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => {
        transport.simulateData('{"va');
        transport.simulateData('lue":7}');
        transport.simulateData("ABCD1234\n");
      }, 0);
      return Promise.resolve();
    });

    await driver.execute("cmd");

    expect(logger.debug).toHaveBeenCalledWith("rx chunk", { chars: 4, buffered: 4 });
    expect(logger.debug).toHaveBeenCalledWith("rx chunk", { chars: 7, buffered: 11 });
    expect(logger.debug).toHaveBeenCalledWith("rx chunk", { chars: 9, buffered: 20 });
  });

  it('emits debug "rx complete" with chars and checksum fields', async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"value":42}ABCD1234\n'), 0);
      return Promise.resolve();
    });

    await driver.execute("cmd");

    expect(logger.debug).toHaveBeenCalledWith("rx complete", { chars: 20, checksum: "ABCD1234" });
  });

  it('reports checksum "none" in "rx complete" for plain-text replies', async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("battery:85\n"), 0);
      return Promise.resolve();
    });

    await driver.execute("battery");

    expect(logger.debug).toHaveBeenCalledWith("rx complete", { chars: 10, checksum: "none" });
  });

  it('emits debug "command completed" with elapsedMs and timeoutMs fields', async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"ok":1}ABCD1234\n'), 0);
      return Promise.resolve();
    });

    await driver.execute("cmd");

    expect(logger.debug).toHaveBeenCalledWith("command completed", {
      elapsedMs: expect.any(Number) as number,
      timeoutMs: MULTISPEQ_FRAMING.DEFAULT_TIMEOUT,
    });
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
      await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);
      await resultPromise;

      expect(logger.warn).toHaveBeenCalledWith("response timeout, sending cancel", {
        timeoutMs: MULTISPEQ_FRAMING.DEFAULT_TIMEOUT,
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
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"ok":1}ABCD1234\n'), 0);
      return Promise.resolve();
    });
    const longCommand = "x".repeat(500);

    await driver.execute(longCommand);

    const txCall = vi.mocked(logger.debug).mock.calls.find(([msg]) => msg === "tx");
    const fields = txCall?.[1] as { command: string };
    expect(fields.command.length).toBeLessThan(200);
    expect(fields.command).toContain("(500 chars)");
  });
});

describe("MultispeqDriver getDeviceIdentity", () => {
  it("maps battery and hello replies onto a multispeq DeviceIdentity", async () => {
    const driver = new MultispeqDriver();
    const transport = createMockTransport();
    driver.initialize(transport);

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
  });

  it("omits name and battery when the device stays silent", async () => {
    const driver = new MultispeqDriver();
    const transport = createMockTransport();
    driver.initialize(transport);
    vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));

    const identity = await driver.getDeviceIdentity();

    expect(identity.family).toBe("multispeq");
    expect(identity.name).toBeUndefined();
    expect(identity.batteryPercent).toBeUndefined();
    expect(identity.raw).toEqual({});
  });
});

describe("MultispeqDriver progress emissions", () => {
  it('emits "sent" then a throttled "receiving" stream across a chunked reply', async () => {
    vi.useFakeTimers();
    try {
      const driver = new MultispeqDriver();
      const transport = createMockTransport();
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => {
          transport.simulateData('{"va');
          transport.simulateData('lue":7}');
          transport.simulateData("ABCD1234\n");
        }, 0);
        return Promise.resolve();
      });

      const events: CommandProgress[] = [];
      driver.onProgress((p) => events.push(p));

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
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops notifying after unsubscribe", async () => {
    const driver = new MultispeqDriver();
    const transport = createMockTransport();
    driver.initialize(transport);

    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"ok":1}ABCD1234\n'), 0);
      return Promise.resolve();
    });

    const events: CommandProgress[] = [];
    const unsubscribe = driver.onProgress((p) => events.push(p));
    unsubscribe();

    await driver.execute("cmd");

    expect(events).toHaveLength(0);
  });
});
