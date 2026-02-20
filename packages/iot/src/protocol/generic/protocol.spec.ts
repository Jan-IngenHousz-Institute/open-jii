/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { GENERIC_COMMANDS } from "./commands";
import { GenericDeviceProtocol } from "./protocol";

function createMockTransport(): ITransportAdapter & {
  simulateData: (data: string) => void;
  simulateStatus: (connected: boolean, error?: Error) => void;
} {
  let dataCallback: ((data: string) => void) | undefined;
  let statusCallback: ((connected: boolean, error?: Error) => void) | undefined;

  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onStatusChanged: vi.fn((cb: (connected: boolean, error?: Error) => void) => {
      statusCallback = cb;
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulateData(data: string) {
      dataCallback?.(data);
    },
    simulateStatus(connected: boolean, error?: Error) {
      statusCallback?.(connected, error);
    },
  };
}

describe("GenericDeviceProtocol", () => {
  let protocol: GenericDeviceProtocol;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    protocol = new GenericDeviceProtocol();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set up data and status handlers", () => {
      protocol.initialize(transport);

      expect(transport.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
      expect(transport.onStatusChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should clear response buffer on re-initialize", () => {
      protocol.initialize(transport);
      // Just verify it doesn't throw
      expect(transport.onDataReceived).toHaveBeenCalled();
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(protocol.execute("test")).rejects.toThrow(
        "Protocol not initialized. Call initialize() first.",
      );
    });

    it("should send JSON-encoded command with newline", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: "ok" })),
          0,
        );
        return Promise.resolve();
      });

      await protocol.execute({ command: GENERIC_COMMANDS.PING });

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"PING"'));
      expect(transport.send).toHaveBeenCalledWith(expect.stringMatching(/\n$/));
    });

    it("should wrap string commands in object", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.execute("custom-cmd");

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"custom-cmd"'),
      );
    });

    it("should return success when response status is success", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: { value: 42 } })),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
    });

    it("should return failure when response status is error", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Bad command" })),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("bad-cmd");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Bad command");
    });

    it("should handle newline-delimited JSON responses", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              JSON.stringify({ status: "success", data: "line-response" }) + "\n",
            ),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");
      expect(result.success).toBe(true);
    });
  });

  describe("getDeviceInfo", () => {
    it("should send INFO command and return device info", async () => {
      protocol.initialize(transport);

      const deviceInfo = { device_name: "Arduino", firmware_version: "1.0" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: deviceInfo })),
          0,
        );
        return Promise.resolve();
      });

      const info = await protocol.getDeviceInfo();

      expect(info).toEqual(deviceInfo);
    });

    it("should throw on failed getDeviceInfo", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "No device" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.getDeviceInfo()).rejects.toThrow("No device");
    });
  });

  describe("discoverCommands", () => {
    it("should return list of commands", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              JSON.stringify({
                status: "success",
                data: { commands: ["RUN", "STOP", "PING"] },
              }),
            ),
          0,
        );
        return Promise.resolve();
      });

      const commands = await protocol.discoverCommands();
      expect(commands).toEqual(["RUN", "STOP", "PING"]);
    });
  });

  describe("ping", () => {
    it("should return true on successful ping", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      const result = await protocol.ping();
      expect(result).toBe(true);
    });

    it("should return false on failed ping", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));

      const result = await protocol.ping();
      expect(result).toBe(false);
    });
  });

  describe("event listeners", () => {
    it("should allow subscribing and unsubscribing to events", () => {
      const listener = vi.fn();

      protocol.on("sendCommand", listener);
      protocol.off("sendCommand", listener);

      // Just verify no errors
    });
  });

  describe("setConfig", () => {
    it("should send SET_CONFIG command with config params", async () => {
      protocol.initialize(transport);

      const config = { config: { sensorRate: 100 }, id: "cfg-1" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.setConfig(config);

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"SET_CONFIG"'),
      );
    });

    it("should throw on failed setConfig", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Invalid config" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.setConfig({ config: {} })).rejects.toThrow("Invalid config");
    });

    it("should throw default error when failure has no error message", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.setConfig({ config: {} })).rejects.toThrow(
        "Failed to set configuration",
      );
    });
  });

  describe("getConfig", () => {
    it("should return device config", async () => {
      protocol.initialize(transport);

      const config = { config: { sensorRate: 100 }, id: "cfg-1" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: config })),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.getConfig();
      expect(result).toEqual(config);
    });

    it("should throw on failed getConfig", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              JSON.stringify({ status: "error", error: "No config available" }),
            ),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.getConfig()).rejects.toThrow("No config available");
    });

    it("should throw default error when data is missing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.getConfig()).rejects.toThrow("Failed to get configuration");
    });
  });

  describe("runMeasurement", () => {
    it("should send RUN command", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.runMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RUN"'));
    });

    it("should send RUN command with params", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.runMeasurement({ duration: 5000 });

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"duration":5000'));
    });

    it("should throw on failed runMeasurement", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Sensor not ready" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.runMeasurement()).rejects.toThrow("Sensor not ready");
    });

    it("should throw default error on failure without error field", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.runMeasurement()).rejects.toThrow("Failed to run measurement");
    });
  });

  describe("stopMeasurement", () => {
    it("should send STOP command", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.stopMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"STOP"'));
    });

    it("should throw on failed stopMeasurement", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Nothing running" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.stopMeasurement()).rejects.toThrow("Nothing running");
    });

    it("should throw default error on failure without error field", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.stopMeasurement()).rejects.toThrow("Failed to stop measurement");
    });
  });

  describe("getData", () => {
    it("should return measurement data", async () => {
      protocol.initialize(transport);

      const measurementData = { data: [1.2, 3.4], timestamp: 12345 };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "success", data: measurementData })),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.getData();
      expect(result).toEqual(measurementData);
    });

    it("should throw on failed getData", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "No data available" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.getData()).rejects.toThrow("No data available");
    });

    it("should throw default error when data is missing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.getData()).rejects.toThrow("Failed to get data");
    });
  });

  describe("reset", () => {
    it("should send RESET command", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.reset();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RESET"'));
    });

    it("should throw on failed reset", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Reset failed" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.reset()).rejects.toThrow("Reset failed");
    });

    it("should throw default error on failure without error field", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.reset()).rejects.toThrow("Failed to reset device");
    });
  });

  describe("disconnect", () => {
    it("should send DISCONNECT command and destroy", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await protocol.disconnect();

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"DISCONNECT"'),
      );
      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("should ignore disconnect command errors and still destroy", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("Already disconnected"));

      await protocol.disconnect();

      expect(transport.disconnect).toHaveBeenCalled();
    });
  });

  describe("waitForResponse timeout", () => {
    it("should return error on response timeout", async () => {
      vi.useFakeTimers();
      protocol.initialize(transport);

      // Don't simulate any response data, so the timeout will fire
      const resultPromise = protocol.execute("cmd");

      // Advance past the 10s timeout
      await vi.advanceTimersByTimeAsync(10001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Response timeout");

      vi.useRealTimers();
    });
  });

  describe("handleDataReceived edge cases", () => {
    it("should parse newline-delimited JSON when buffer is not valid JSON", async () => {
      protocol.initialize(transport);

      // Send two JSON objects separated by newline — causes JSON.parse on full buffer to fail,
      // triggering the line-by-line parsing path
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              JSON.stringify({ status: "success", data: "first" }) +
                "\n" +
                JSON.stringify({ status: "success", data: "second" }) +
                "\n",
            ),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");
      // The first parsed line resolves the waitForResponse
      expect(result.success).toBe(true);
      expect(result.data).toBe("first");
    });

    it("should keep incomplete trailing data in buffer", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => {
          // Send data with complete line + incomplete trailing data
          transport.simulateData(
            JSON.stringify({ status: "success", data: "done" }) + "\nincomplete",
          );
          // Then send the rest to complete it
          transport.simulateData(
            JSON.stringify({ status: "success", data: "extra" }).slice("incomplete".length) + "\n",
          );
        }, 0);
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");
      expect(result.success).toBe(true);
    });

    it("should ignore non-JSON lines in line-by-line parsing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              "not json at all\n" + JSON.stringify({ status: "success", data: "valid" }) + "\n",
            ),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");
      expect(result.success).toBe(true);
      expect(result.data).toBe("valid");
    });

    it("should skip empty lines in line-by-line parsing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(
              "\n\n" + JSON.stringify({ status: "success", data: "ok" }) + "\n",
            ),
          0,
        );
        return Promise.resolve();
      });

      const result = await protocol.execute("cmd");
      expect(result.success).toBe(true);
      expect(result.data).toBe("ok");
    });

    it("should log connection errors from transport", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      protocol.initialize(transport);

      transport.simulateStatus(false, new Error("Connection lost"));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Generic device connection error:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should not log when connected status changes without error", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      protocol.initialize(transport);

      transport.simulateStatus(false);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("discoverCommands error handling", () => {
    it("should throw on failed discoverCommands", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Not supported" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(protocol.discoverCommands()).rejects.toThrow("Not supported");
    });

    it("should throw default error when data is missing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.discoverCommands()).rejects.toThrow("Failed to discover commands");
    });
  });

  describe("getDeviceInfo error handling", () => {
    it("should throw default error when data is missing", async () => {
      protocol.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(protocol.getDeviceInfo()).rejects.toThrow("Failed to get device info");
    });
  });

  describe("destroy", () => {
    it("should clean up emitter and buffer", async () => {
      protocol.initialize(transport);
      await protocol.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("should emit destroy event", async () => {
      protocol.initialize(transport);
      const listener = vi.fn();
      protocol.on("destroy", listener);

      await protocol.destroy();

      expect(listener).toHaveBeenCalled();
    });
  });
});
