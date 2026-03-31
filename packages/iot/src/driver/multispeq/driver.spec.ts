/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
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
