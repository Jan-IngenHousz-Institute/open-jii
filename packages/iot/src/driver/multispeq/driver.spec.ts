import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { MULTISPEQ_CONSOLE } from "./commands";
import { MULTISPEQ_FRAMING } from "./config";
import { MultispeqDriver } from "./driver";

/**
 * Minimal protocol whose estimated runtime exceeds the 60 s base timeout.
 * 100 pulses × 1000 µs = 100 ms train, × 1000 protocol_repeats = 100_000 ms.
 * computeScanTimeoutMs → 100_000 × 2 + 10_000 = 210_000 ms.
 */
const LONG_PROTOCOL = [
  {
    v_arrays: [],
    set_repeats: 1,
    _protocol_set_: [{ pulses: [100], pulse_distance: [1000], protocol_repeats: 1000 }],
  },
];
const LONG_PROTOCOL_TIMEOUT_MS = 210_000;
const CANCEL_FRAME = `${MULTISPEQ_CONSOLE.CANCEL}${MULTISPEQ_FRAMING.LINE_ENDING}`;

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

describe("MultispeqDriver", () => {
  let driver: MultispeqDriver;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    driver = new MultispeqDriver();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set up data handler on transport", () => {
      driver.initialize(transport);
      expect(transport.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(driver.execute("test")).rejects.toThrow(
        "Driver not initialized. Call initialize() first.",
      );
    });

    it("should send command with line ending", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"result":"ok"}ABCD1234\n'), 0);
        return Promise.resolve();
      });

      const result = await driver.execute("test-cmd");

      expect(transport.send).toHaveBeenCalledWith(`test-cmd${MULTISPEQ_FRAMING.LINE_ENDING}`);
      expect(result.success).toBe(true);
    });

    it("should stringify object commands", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"ok":true}CHECKSUM1\n'), 0);
        return Promise.resolve();
      });

      await driver.execute({ command: "RUN" });

      expect(transport.send).toHaveBeenCalledWith(
        `{"command":"RUN"}${MULTISPEQ_FRAMING.LINE_ENDING}`,
      );
    });

    it("should extract checksum from JSON response (last 8 chars)", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"value":42}ABCD1234\n'), 0);
        return Promise.resolve();
      });

      const result = await driver.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.checksum).toBe("ABCD1234");
      expect(result.data).toEqual({ value: 42 });
    });

    it("should not extract checksum from plain text response", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("MultispeQ Ready\n"), 0);
        return Promise.resolve();
      });

      const result = await driver.execute("hello");

      expect(result.success).toBe(true);
      expect(result.data).toBe("MultispeQ Ready");
      expect(result.checksum).toBeUndefined();
    });

    it("should buffer incomplete messages until newline", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => {
          // Send data in chunks
          transport.simulateData('{"val');
          transport.simulateData('ue":1}');
          transport.simulateData("CKSUM123\n");
        }, 0);
        return Promise.resolve();
      });

      const result = await driver.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 1 });
    });

    it("should return raw string when response is plain text", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("battery:85\n"), 0);
        return Promise.resolve();
      });

      const result = await driver.execute("battery");

      expect(result.success).toBe(true);
      expect(result.data).toBe("battery:85");
      expect(result.checksum).toBeUndefined();
    });

    it("should return failure on transport error", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("Send failed"));

      const result = await driver.execute("cmd");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Send failed");
    });
  });

  describe("getDeviceInfo", () => {
    it("should return battery and device name from battery and hello commands", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // battery command — plain text
          setTimeout(() => transport.simulateData("battery:92\n"), 0);
        } else {
          // hello command — plain text
          setTimeout(() => transport.simulateData("MultispeQ_\n"), 0);
        }
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(transport.send).toHaveBeenCalledWith(`battery${MULTISPEQ_FRAMING.LINE_ENDING}`);
      expect(transport.send).toHaveBeenCalledWith(`hello${MULTISPEQ_FRAMING.LINE_ENDING}`);
      expect(info.device_battery).toBe(92);
      expect(info.device_name).toBe("MultispeQ_");
    });

    it("should return only battery when hello fails", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // battery succeeds — plain text
          setTimeout(() => transport.simulateData("battery:85\n"), 0);
          return Promise.resolve();
        }
        // hello fails
        return Promise.reject(new Error("timeout"));
      });

      const info = await driver.getDeviceInfo();

      expect(info.device_battery).toBe(85);
      expect(info.device_name).toBeUndefined();
    });

    it("should return only device name when battery fails", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // battery fails
          return Promise.reject(new Error("timeout"));
        }
        // hello succeeds — plain text
        setTimeout(() => transport.simulateData("MultispeQ_\n"), 0);
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info.device_battery).toBeUndefined();
      expect(info.device_name).toBe("MultispeQ_");
    });

    it("should return empty info when both commands fail", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));

      const info = await driver.getDeviceInfo();

      expect(info).toEqual({});
    });
  });

  describe("destroy", () => {
    it("should clean up emitter and buffer", async () => {
      driver.initialize(transport);
      await driver.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("aborts an in-flight command instead of letting it hang until timeout", async () => {
      driver.initialize(transport);

      // Start a long protocol that never replies, so it stays in-flight.
      const resultPromise = driver.execute(LONG_PROTOCOL);
      // Let the queued task register its response wait.
      await Promise.resolve();
      await Promise.resolve();

      // Destroying (e.g. the device disconnects mid-measurement) must reject the
      // pending command now rather than after its multi-minute timeout.
      await driver.destroy();

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command cancelled");
    });
  });

  describe("waitForResponse timeout", () => {
    it("should return failure on response timeout", async () => {
      vi.useFakeTimers();
      driver.initialize(transport);

      // Don't simulate any response so the timeout fires
      const resultPromise = driver.execute("cmd");

      await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");

      vi.useRealTimers();
    });

    it("should send the cancel switch (-1+) when a command times out", async () => {
      // Long-running protocols leave the device mid-measurement; without a
      // cancel it keeps the actinic light on and drops the link
      vi.useFakeTimers();
      driver.initialize(transport);

      const resultPromise = driver.execute("cmd");
      await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);
      await resultPromise;

      expect(transport.send).toHaveBeenCalledWith(CANCEL_FRAME);

      vi.useRealTimers();
    });
  });

  describe("stale reply isolation (OJD-1565)", () => {
    it("does not let a timed-out command's buffered fragment leak into the next command", async () => {
      vi.useFakeTimers();
      try {
        driver.initialize(transport);

        // Command A never gets a complete reply, so it times out at the base budget.
        const aResult = driver.execute("A");
        await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);
        expect((await aResult).success).toBe(false);

        // A partial frame from A lands after the timeout and sits in the buffer.
        transport.simulateData('{"stale":"A"}');

        // Command B then runs; the next send delivers B's own complete reply.
        // Without the pre-send buffer flush, A's fragment would fuse with B's
        // reply and B would resolve with corrupted data.
        vi.mocked(transport.send).mockImplementationOnce(() => {
          setTimeout(() => transport.simulateData('{"fresh":"B"}ABCD1234\n'), 0);
          return Promise.resolve();
        });
        const bResultPromise = driver.execute("B");
        await vi.advanceTimersByTimeAsync(1);
        const bResult = await bResultPromise;

        expect(bResult.success).toBe(true);
        expect(bResult.data).toEqual({ fresh: "B" });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("cancel", () => {
    it("aborts an in-flight command, sends -1+, and rejects as cancelled", async () => {
      driver.initialize(transport);

      // Start a long protocol but never reply, so it stays in-flight.
      const resultPromise = driver.execute(LONG_PROTOCOL);
      // Let the queued task run far enough to register the response wait.
      await Promise.resolve();
      await Promise.resolve();

      await driver.cancel();

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command cancelled");
      expect(transport.send).toHaveBeenCalledWith(CANCEL_FRAME);
    });

    it("is a no-op when idle (no stray -1+ that could mismatch a later command)", async () => {
      driver.initialize(transport);

      await driver.cancel();

      expect(transport.send).not.toHaveBeenCalledWith(CANCEL_FRAME);
    });

    it("does not abort a command that already completed", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"done":true}ABCD1234\n'), 0);
        return Promise.resolve();
      });
      const result = await driver.execute("cmd");
      expect(result.success).toBe(true);

      // Cancelling after completion must not send a cancel switch.
      vi.mocked(transport.send).mockClear();
      await driver.cancel();
      expect(transport.send).not.toHaveBeenCalledWith(CANCEL_FRAME);
    });
  });

  describe("dynamic protocol timeout", () => {
    it("does not time out a long protocol at the 60s base timeout", async () => {
      vi.useFakeTimers();
      driver.initialize(transport);

      const resultPromise = driver.execute(LONG_PROTOCOL);

      // Past the base 60 s timeout — a long protocol must still be waiting.
      await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);
      transport.simulateData('{"ok":1}ABCD1234\n');

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ok: 1 });
      expect(transport.send).not.toHaveBeenCalledWith(CANCEL_FRAME);

      vi.useRealTimers();
    });

    it("times out a long protocol at its computed budget and cancels", async () => {
      vi.useFakeTimers();
      driver.initialize(transport);

      const resultPromise = driver.execute(LONG_PROTOCOL);

      // Just before the computed budget: still pending.
      await vi.advanceTimersByTimeAsync(LONG_PROTOCOL_TIMEOUT_MS - 1);
      expect(transport.send).not.toHaveBeenCalledWith(CANCEL_FRAME);

      // Crossing the budget: rejects as timeout and cancels the device.
      await vi.advanceTimersByTimeAsync(2);
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");
      expect(transport.send).toHaveBeenCalledWith(CANCEL_FRAME);

      vi.useRealTimers();
    });

    it("honours an explicit per-call timeoutMs override", async () => {
      vi.useFakeTimers();
      driver.initialize(transport);

      const resultPromise = driver.execute("cmd", { timeoutMs: 5_000 });
      await vi.advanceTimersByTimeAsync(5_001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");

      vi.useRealTimers();
    });

    it("uses the constructor config timeout as the base for string commands", async () => {
      vi.useFakeTimers();
      const configured = new MultispeqDriver(undefined, { timeout: 5_000 });
      configured.initialize(transport);

      const resultPromise = configured.execute("cmd");
      await vi.advanceTimersByTimeAsync(5_001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");

      vi.useRealTimers();
    });
  });

  describe("getDeviceInfo edge cases", () => {
    it("should return only device name when battery value is NaN", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // battery returns non-numeric — plain text
          setTimeout(() => transport.simulateData("battery:abc\n"), 0);
        } else {
          // hello succeeds — plain text
          setTimeout(() => transport.simulateData("MultispeQ_\n"), 0);
        }
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info.device_battery).toBeUndefined();
      expect(info.device_name).toBe("MultispeQ_");
    });
  });
});
