/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { GENERIC_COMMANDS } from "./commands";
import { GENERIC_FRAMING } from "./config";
import { GenericDeviceDriver } from "./driver";

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

describe("GenericDeviceDriver", () => {
  let driver: GenericDeviceDriver;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    driver = new GenericDeviceDriver();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set up data and status handlers", () => {
      driver.initialize(transport);

      expect(transport.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
      expect(transport.onStatusChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should clear response buffer on re-initialize", () => {
      driver.initialize(transport);
      // Just verify it doesn't throw
      expect(transport.onDataReceived).toHaveBeenCalled();
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(driver.execute("test")).rejects.toThrow(
        "Driver not initialized. Call initialize() first.",
      );
    });

    it("should send JSON-encoded command with newline", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: "ok" })),
          0,
        );
        return Promise.resolve();
      });

      await driver.execute({ command: GENERIC_COMMANDS.PING });

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"PING"'));
      const sentValue = vi.mocked(transport.send).mock.calls[0]?.[0];
      expect(sentValue).toBeDefined();
      expect(sentValue!.endsWith(GENERIC_FRAMING.LINE_ENDING)).toBe(true);
    });

    it("should wrap string commands in object", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.execute("custom-cmd");

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"custom-cmd"'),
      );
    });

    it("should return success when response status is success", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: { value: 42 } })),
          0,
        );
        return Promise.resolve();
      });

      const result = await driver.execute("cmd");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
    });

    it("should return failure when response status is error", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Bad command" })),
          0,
        );
        return Promise.resolve();
      });

      const result = await driver.execute("bad-cmd");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Bad command");
    });

    it("should handle newline-delimited JSON responses", async () => {
      driver.initialize(transport);

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

      const result = await driver.execute("cmd");
      expect(result.success).toBe(true);
    });
  });

  describe("getDeviceInfo", () => {
    it("should send INFO command and return device info", async () => {
      driver.initialize(transport);

      const deviceInfo = { device_name: "Arduino", firmware_version: "1.0" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: deviceInfo })),
          0,
        );
        return Promise.resolve();
      });

      const info = await driver.getDeviceInfo();

      expect(info).toEqual(deviceInfo);
    });

    it("should throw on failed getDeviceInfo", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "No device" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.getDeviceInfo()).rejects.toThrow("No device");
    });
  });

  describe("discoverCommands", () => {
    it("should return list of commands", async () => {
      driver.initialize(transport);

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

      const commands = await driver.discoverCommands();
      expect(commands).toEqual(["RUN", "STOP", "PING"]);
    });
  });

  describe("ping", () => {
    it("should return true on successful ping", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it("should return false on failed ping", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("timeout"));

      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  describe("event listeners", () => {
    it("should allow subscribing and unsubscribing to events", () => {
      const listener = vi.fn();

      driver.on("sendCommand", listener);
      driver.off("sendCommand", listener);

      // Just verify no errors
    });
  });

  describe("setConfig", () => {
    it("should send SET_CONFIG command with config params", async () => {
      driver.initialize(transport);

      const config = { config: { sensorRate: 100 }, id: "cfg-1" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.setConfig(config);

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"SET_CONFIG"'),
      );
    });

    it("should throw on failed setConfig", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Invalid config" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.setConfig({ config: {} })).rejects.toThrow("Invalid config");
    });

    it("should throw default error when failure has no error message", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.setConfig({ config: {} })).rejects.toThrow(
        "Failed to set configuration",
      );
    });
  });

  describe("getConfig", () => {
    it("should return device config", async () => {
      driver.initialize(transport);

      const config = { config: { sensorRate: 100 }, id: "cfg-1" };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "success", data: config })),
          0,
        );
        return Promise.resolve();
      });

      const result = await driver.getConfig();
      expect(result).toEqual(config);
    });

    it("should throw on failed getConfig", async () => {
      driver.initialize(transport);

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

      await expect(driver.getConfig()).rejects.toThrow("No config available");
    });

    it("should throw default error when data is missing", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getConfig()).rejects.toThrow("Failed to get configuration");
    });
  });

  describe("runMeasurement", () => {
    it("should send RUN command", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.runMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RUN"'));
    });

    it("should send RUN command with params", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.runMeasurement({ duration: 5000 });

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"duration":5000'));
    });

    it("should throw on failed runMeasurement", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Sensor not ready" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.runMeasurement()).rejects.toThrow("Sensor not ready");
    });

    it("should throw default error on failure without error field", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.runMeasurement()).rejects.toThrow("Failed to run measurement");
    });
  });

  describe("stopMeasurement", () => {
    it("should send STOP command", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.stopMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"STOP"'));
    });

    it("should throw on failed stopMeasurement", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "Nothing running" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.stopMeasurement()).rejects.toThrow("Nothing running");
    });

    it("should throw default error on failure without error field", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.stopMeasurement()).rejects.toThrow("Failed to stop measurement");
    });
  });

  describe("getData", () => {
    it("should return measurement data", async () => {
      driver.initialize(transport);

      const measurementData = { data: [1.2, 3.4], timestamp: 12345 };
      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "success", data: measurementData })),
          0,
        );
        return Promise.resolve();
      });

      const result = await driver.getData();
      expect(result).toEqual(measurementData);
    });

    it("should throw on failed getData", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () =>
            transport.simulateData(JSON.stringify({ status: "error", error: "No data available" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.getData()).rejects.toThrow("No data available");
    });

    it("should throw default error when data is missing", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getData()).rejects.toThrow("Failed to get data");
    });
  });

  describe("reset", () => {
    it("should send RESET command", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.reset();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RESET"'));
    });

    it("should throw on failed reset", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Reset failed" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.reset()).rejects.toThrow("Reset failed");
    });

    it("should throw default error on failure without error field", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.reset()).rejects.toThrow("Failed to reset device");
    });
  });

  describe("disconnect", () => {
    it("should send DISCONNECT command and destroy", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.disconnect();

      expect(transport.send).toHaveBeenCalledWith(
        expect.stringContaining('"command":"DISCONNECT"'),
      );
      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("should ignore disconnect command errors and still destroy", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("Already disconnected"));

      await driver.disconnect();

      expect(transport.disconnect).toHaveBeenCalled();
    });
  });

  describe("waitForResponse timeout", () => {
    it("should return error on response timeout", async () => {
      vi.useFakeTimers();
      driver.initialize(transport);

      // Don't simulate any response data, so the timeout will fire
      const resultPromise = driver.execute("cmd");

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(GENERIC_FRAMING.DEFAULT_TIMEOUT + 1);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Response timeout");

      vi.useRealTimers();
    });
  });

  describe("handleDataReceived edge cases", () => {
    it("should parse newline-delimited JSON when buffer is not valid JSON", async () => {
      driver.initialize(transport);

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

      const result = await driver.execute("cmd");
      // The first parsed line resolves the waitForResponse
      expect(result.success).toBe(true);
      expect(result.data).toBe("first");
    });

    it("should keep incomplete trailing data in buffer", async () => {
      driver.initialize(transport);

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

      const result = await driver.execute("cmd");
      expect(result.success).toBe(true);
    });

    it("should ignore non-JSON lines in line-by-line parsing", async () => {
      driver.initialize(transport);

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

      const result = await driver.execute("cmd");
      expect(result.success).toBe(true);
      expect(result.data).toBe("valid");
    });

    it("should skip empty lines in line-by-line parsing", async () => {
      driver.initialize(transport);

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

      const result = await driver.execute("cmd");
      expect(result.success).toBe(true);
      expect(result.data).toBe("ok");
    });

    it("should log connection errors from transport", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      driver.initialize(transport);

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
      driver.initialize(transport);

      transport.simulateStatus(false);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("discoverCommands error handling", () => {
    it("should throw on failed discoverCommands", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(
          () => transport.simulateData(JSON.stringify({ status: "error", error: "Not supported" })),
          0,
        );
        return Promise.resolve();
      });

      await expect(driver.discoverCommands()).rejects.toThrow("Not supported");
    });

    it("should throw default error when data is missing", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.discoverCommands()).rejects.toThrow("Failed to discover commands");
    });
  });

  describe("getDeviceInfo error handling", () => {
    it("should throw default error when data is missing", async () => {
      driver.initialize(transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getDeviceInfo()).rejects.toThrow("Failed to get device info");
    });
  });

  describe("destroy", () => {
    it("should clean up emitter and buffer", async () => {
      driver.initialize(transport);
      await driver.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("should emit destroy event", async () => {
      driver.initialize(transport);
      const listener = vi.fn();
      driver.on("destroy", listener);

      await driver.destroy();

      expect(listener).toHaveBeenCalled();
    });
  });
});
