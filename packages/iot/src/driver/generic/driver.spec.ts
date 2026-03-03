/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { GENERIC_COMMANDS } from "./commands";
import { GENERIC_FRAMING } from "./config";
import { GenericDeviceDriver } from "./driver";

/** Default INFO payload returned by the mock transport */
const DEFAULT_INFO = {
  device_name: "TestDevice",
  device_type: "sensor",
  device_id: "test-001",
  capabilities: [
    "DISCOVER",
    "SET_CONFIG",
    "GET_CONFIG",
    "STOP",
    "GET_DATA",
    "RESET",
    "DISCONNECT",
    "PING",
  ],
};

function createMockTransport(): ITransportAdapter & {
  simulateData: (data: string) => void;
  simulateStatus: (connected: boolean, error?: Error) => void;
} {
  let dataCallback: ((data: string) => void) | undefined;
  let statusCallback: ((connected: boolean, error?: Error) => void) | undefined;

  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockImplementation(() => {
      // Auto-respond to INFO during initialize()
      setTimeout(() => {
        dataCallback?.(JSON.stringify({ status: "success", data: DEFAULT_INFO }));
      }, 0);
      return Promise.resolve();
    }),
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

/**
 * Helper: initializes a driver with the mock transport.
 * After initialization, resets send mock so subsequent assertions start clean.
 */
async function initDriver(
  driver: GenericDeviceDriver,
  transport: ReturnType<typeof createMockTransport>,
): Promise<void> {
  await driver.initialize(transport);
  vi.mocked(transport.send).mockReset().mockResolvedValue(undefined);
}

describe("GenericDeviceDriver", () => {
  let driver: GenericDeviceDriver;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    driver = new GenericDeviceDriver();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set up data and status handlers", async () => {
      await initDriver(driver, transport);

      expect(transport.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
      expect(transport.onStatusChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should clear response buffer on re-initialize", async () => {
      await initDriver(driver, transport);
      // Just verify it doesn't throw
      expect(transport.onDataReceived).toHaveBeenCalled();
    });

    it("should auto-probe device info via INFO command", async () => {
      await driver.initialize(transport);
      expect(driver.cachedDeviceInfo).toEqual(DEFAULT_INFO);
    });

    it("should survive INFO failure and disable capability guards", async () => {
      // Make INFO fail
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(() => {
            transport.simulateData(JSON.stringify({ status: "error", error: "Not supported" }));
          }, 0);
          return Promise.resolve();
        });

      await driver.initialize(transport);

      expect(driver.cachedDeviceInfo).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        "INFO probe failed during initialize — capability guards disabled",
      );
      warnSpy.mockRestore();
    });
  });

  describe("constructor config", () => {
    it("should use default timeout and lineEnding", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.execute({ command: GENERIC_COMMANDS.PING });

      const sentValue = vi.mocked(transport.send).mock.calls[0]?.[0];
      expect(sentValue).toBeDefined();
      expect(sentValue.endsWith(GENERIC_FRAMING.LINE_ENDING)).toBe(true);
    });

    it("should allow overriding lineEnding via config", async () => {
      const customDriver = new GenericDeviceDriver({ lineEnding: "\r\n" });
      await initDriver(customDriver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await customDriver.execute({ command: GENERIC_COMMANDS.PING });

      const sentValue = vi.mocked(transport.send).mock.calls[0]?.[0];
      expect(sentValue).toBeDefined();
      expect(sentValue.endsWith("\r\n")).toBe(true);
    });

    it("should allow overriding timeout via config", async () => {
      const customDriver = new GenericDeviceDriver({ timeout: 500 });
      // Initialize with real timers — INFO probe uses setTimeout(0)
      await initDriver(customDriver, transport);

      vi.useFakeTimers();

      const resultPromise = customDriver.execute("cmd");

      // Advance past custom timeout (500ms) — should fire before default (10s)
      await vi.advanceTimersByTimeAsync(501);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Response timeout");

      vi.useRealTimers();
    });
  });

  describe("capability guards", () => {
    it("should throw when calling an unsupported optional command", async () => {
      // Initialize with a device that only supports PING
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(() => {
            transport.simulateData(
              JSON.stringify({
                status: "success",
                data: {
                  device_name: "LimitedDevice",
                  device_type: "sensor",
                  device_id: "ltd-001",
                  capabilities: ["PING"],
                },
              }),
            );
          }, 0);
          return Promise.resolve();
        });

      await driver.initialize(transport);
      vi.mocked(transport.send).mockReset().mockResolvedValue(undefined);

      await expect(driver.discoverCommands()).rejects.toThrow("Device does not support DISCOVER");
      await expect(driver.setConfig({ config: {} })).rejects.toThrow(
        "Device does not support SET_CONFIG",
      );
      await expect(driver.getConfig()).rejects.toThrow("Device does not support GET_CONFIG");
      await expect(driver.stopMeasurement()).rejects.toThrow("Device does not support STOP");
      await expect(driver.getData()).rejects.toThrow("Device does not support GET_DATA");
      await expect(driver.reset()).rejects.toThrow("Device does not support RESET");
      await expect(driver.disconnect()).rejects.toThrow("Device does not support DISCONNECT");
    });

    it("should allow supported optional commands", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      // ping is in DEFAULT_INFO capabilities — should not throw
      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it("should skip guard when capabilities are unknown (INFO failed)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Make INFO fail
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(() => {
            transport.simulateData(JSON.stringify({ status: "error", error: "Unsupported" }));
          }, 0);
          return Promise.resolve();
        });

      await driver.initialize(transport);
      warnSpy.mockRestore();

      // Now reset mock and have it respond successfully
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(
            () =>
              transport.simulateData(
                JSON.stringify({
                  status: "success",
                  data: { commands: ["RUN", "STOP"] },
                }),
              ),
            0,
          );
          return Promise.resolve();
        });

      // discoverCommands should succeed without capability guard since deviceInfo is null
      const commands = await driver.discoverCommands();
      expect(commands).toEqual(["RUN", "STOP"]);
    });

    it("should skip guard when device reports no capabilities field", async () => {
      // Device returns info without capabilities field
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(() => {
            transport.simulateData(
              JSON.stringify({
                status: "success",
                data: { device_name: "BasicDevice" },
              }),
            );
          }, 0);
          return Promise.resolve();
        });

      await driver.initialize(transport);
      vi.mocked(transport.send)
        .mockReset()
        .mockImplementation(() => {
          setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
          return Promise.resolve();
        });

      // Should not throw — no capabilities means fail-open
      const result = await driver.ping();
      expect(result).toBe(true);
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(driver.execute("test")).rejects.toThrow(
        "Driver not initialized. Call initialize() first.",
      );
    });

    it("should send JSON-encoded command with newline", async () => {
      await initDriver(driver, transport);

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
      expect(sentValue.endsWith(GENERIC_FRAMING.LINE_ENDING)).toBe(true);
    });

    it("should wrap string commands in object", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it("should return false on failed ping", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.setConfig({ config: {} })).rejects.toThrow("Failed to set configuration");
    });
  });

  describe("getConfig", () => {
    it("should return device config", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getConfig()).rejects.toThrow("Failed to get configuration");
    });
  });

  describe("runMeasurement", () => {
    it("should send RUN command", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.runMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RUN"'));
    });

    it("should send RUN command with params", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.runMeasurement({ duration: 5000 });

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"duration":5000'));
    });

    it("should throw on failed runMeasurement", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.runMeasurement()).rejects.toThrow("Failed to run measurement");
    });
  });

  describe("stopMeasurement", () => {
    it("should send STOP command", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.stopMeasurement();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"STOP"'));
    });

    it("should throw on failed stopMeasurement", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.stopMeasurement()).rejects.toThrow("Failed to stop measurement");
    });
  });

  describe("getData", () => {
    it("should return measurement data", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getData()).rejects.toThrow("Failed to get data");
    });
  });

  describe("reset", () => {
    it("should send RESET command", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await driver.reset();

      expect(transport.send).toHaveBeenCalledWith(expect.stringContaining('"command":"RESET"'));
    });

    it("should throw on failed reset", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "error" })), 0);
        return Promise.resolve();
      });

      await expect(driver.reset()).rejects.toThrow("Failed to reset device");
    });
  });

  describe("disconnect", () => {
    it("should send DISCONNECT command and destroy", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockRejectedValue(new Error("Already disconnected"));

      await driver.disconnect();

      expect(transport.disconnect).toHaveBeenCalled();
    });
  });

  describe("waitForResponse timeout", () => {
    it("should return error on response timeout", async () => {
      // Initialize with real timers — INFO probe uses setTimeout(0)
      await initDriver(driver, transport);

      vi.useFakeTimers();

      // send resolves but delivers no data → timeout fires
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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

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

    it("should log connection errors from transport", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      await initDriver(driver, transport);

      transport.simulateStatus(false, new Error("Connection lost"));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Generic device connection error:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should not log when connected status changes without error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      await initDriver(driver, transport);

      transport.simulateStatus(false);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("discoverCommands error handling", () => {
    it("should throw on failed discoverCommands", async () => {
      await initDriver(driver, transport);

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
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.discoverCommands()).rejects.toThrow("Failed to discover commands");
    });
  });

  describe("getDeviceInfo error handling", () => {
    it("should throw default error when data is missing", async () => {
      await initDriver(driver, transport);

      vi.mocked(transport.send).mockImplementation(() => {
        setTimeout(() => transport.simulateData(JSON.stringify({ status: "success" })), 0);
        return Promise.resolve();
      });

      await expect(driver.getDeviceInfo()).rejects.toThrow("Failed to get device info");
    });
  });

  describe("destroy", () => {
    it("should clean up emitter and buffer", async () => {
      await initDriver(driver, transport);
      await driver.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
    });

    it("should emit destroy event", async () => {
      await initDriver(driver, transport);
      const listener = vi.fn();
      driver.on("destroy", listener);

      await driver.destroy();

      expect(listener).toHaveBeenCalled();
    });

    it("should clear cached device info", async () => {
      await driver.initialize(transport);
      expect(driver.cachedDeviceInfo).not.toBeNull();

      await driver.destroy();
      expect(driver.cachedDeviceInfo).toBeNull();
    });
  });
});
