/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { MULTISPEQ_COMMANDS } from "./commands";
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

      // Simulate response arriving after send
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

    it("should extract checksum from response (last 8 chars)", async () => {
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

    it("should return raw string when response is not valid JSON", async () => {
      driver.initialize(transport);

      // "battery:85" + 8-char checksum + newline
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("battery:8512345678\n"), 0);
        return Promise.resolve();
      });

      const result = await driver.execute("battery");

      expect(result.success).toBe(true);
      // extractChecksum removes last 8 chars, tryParseJson returns raw string
      expect(result.data).toBe("battery:85");
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
    it("should return parsed device_info JSON when available", async () => {
      driver.initialize(transport);

      const deviceInfoJson = {
        device_name: "MultispeQ",
        device_version: "2.0038",
        device_id: "abc-123",
        device_battery: 92,
      };
      const jsonStr = JSON.stringify(deviceInfoJson);
      const checksum = "ABCD1234";

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(`${jsonStr}${checksum}\n`), 0);
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(transport.send).toHaveBeenCalledWith(`device_info${MULTISPEQ_FRAMING.LINE_ENDING}`);
      expect(info.device_battery).toBe(92);
      expect(info.device_version).toBe("2.0038");
      expect(info.device_id).toBe("abc-123");
    });

    it("should fall back to battery command when device_info fails", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // device_info fails
          return Promise.reject(new Error("timeout"));
        }
        // battery succeeds
        setTimeout(() => transport.simulateData("battery:8512345678\n"), 0);
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info.device_battery).toBe(85);
    });

    it("should fall back to battery when device_info returns non-object", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // device_info returns a raw string (older firmware)
          setTimeout(() => transport.simulateData("unknown_cmd12345678\n"), 0);
        } else {
          // battery command
          setTimeout(() => transport.simulateData("battery:7012345678\n"), 0);
        }
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info.device_battery).toBe(70);
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
    it("should return empty info when battery fallback value is NaN", async () => {
      driver.initialize(transport);

      let callCount = 0;
      vi.mocked(transport.send).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // device_info returns non-object
          setTimeout(() => transport.simulateData("not_json_12345678\n"), 0);
        } else {
          // battery returns non-numeric
          setTimeout(() => transport.simulateData("battery:abc12345678\n"), 0);
        }
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info).toEqual({});
    });
  });
});
