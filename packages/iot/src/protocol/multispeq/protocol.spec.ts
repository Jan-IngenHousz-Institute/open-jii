/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { MultispeqProtocol } from "./protocol";

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

describe("MultispeqProtocol", () => {
  let protocol: MultispeqProtocol;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    protocol = new MultispeqProtocol();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set up data handler on transport", () => {
      protocol.initialize(transport);
      expect(transport.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(protocol.execute("test")).rejects.toThrow(
        "Protocol not initialized. Call initialize() first.",
      );
    });

    it("should send command with line ending", async () => {
      protocol.initialize(transport);

      // Simulate response arriving after send
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"result":"ok"}ABCD1234\n'), 0);
        return Promise.resolve();
      });

      const result = await protocol.execute("test-cmd");

      expect(transport.send).toHaveBeenCalledWith("test-cmd\r\n");
      expect(result.success).toBe(true);
    });

    it("should stringify object commands", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"ok":true}CHECKSUM1\n'), 0);
        return Promise.resolve();
      });

      await protocol.execute({ command: "RUN" });

      expect(transport.send).toHaveBeenCalledWith('{"command":"RUN"}\r\n');
    });

    it("should extract checksum from response (last 8 chars)", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData('{"value":42}ABCD1234\n'), 0);
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.checksum).toBe("ABCD1234");
      expect(result.data).toEqual({ value: 42 });
    });

    it("should buffer incomplete messages until newline", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => {
          // Send data in chunks
          transport.simulateData('{"val');
          transport.simulateData('ue":1}');
          transport.simulateData("CKSUM123\n");
        }, 0);
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 1 });
    });

    it("should return raw string when response is not valid JSON", async () => {
      protocol.initialize(transport);

      // "battery:85" + 8-char checksum + newline
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("battery:8512345678\n"), 0);
        return Promise.resolve();
      });

      const result = await protocol.execute("battery");

      expect(result.success).toBe(true);
      // extractChecksum removes last 8 chars, tryParseJson returns raw string
      expect(result.data).toBe("battery:85");
    });

    it("should return failure on transport error", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("Send failed"));

      const result = await protocol.execute("cmd");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Send failed");
    });
  });

  describe("getDeviceInfo", () => {
    it("should parse battery level from response", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("battery:8512345678\n"), 0);
        return Promise.resolve();
      });

      const info = await protocol.getDeviceInfo();

      expect(info.device_battery).toBe(85);
    });

    it("should return empty info on failed battery command", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));

      const info = await protocol.getDeviceInfo();

      expect(info).toEqual({});
    });
  });

  describe("destroy", () => {
    it("should clean up emitter and buffer", async () => {
      protocol.initialize(transport);
      await protocol.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
    });
  });

  describe("waitForResponse timeout", () => {
    it("should return failure on response timeout", async () => {
      vi.useFakeTimers();
      protocol.initialize(transport);

      // Don't simulate any response so the 30s timeout fires
      const resultPromise = protocol.execute("cmd");

      await vi.advanceTimersByTimeAsync(30001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");

      vi.useRealTimers();
    });
  });

  describe("getDeviceInfo edge cases", () => {
    it("should return empty info when battery value is NaN", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData("battery:abc12345678\n"), 0);
        return Promise.resolve();
      });

      const info = await protocol.getDeviceInfo();

      expect(info).toEqual({});
    });
  });
});
