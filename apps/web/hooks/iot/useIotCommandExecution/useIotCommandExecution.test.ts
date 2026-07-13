import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { IDeviceDriver } from "@repo/iot";

import { useIotCommandExecution } from "./useIotCommandExecution";

describe("useIotCommandExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeCommandCode function", () => {
    it("provides executeCommandCode function", () => {
      const { result } = renderHook(() => useIotCommandExecution(null, false, "multispeq"));
      expect(typeof result.current.executeCommandCode).toBe("function");
    });

    it("throws error when not connected", async () => {
      const { result } = renderHook(() => useIotCommandExecution(null, false, "multispeq"));

      await expect(result.current.executeCommandCode([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });

    it("throws error when driver is null", async () => {
      const { result } = renderHook(() => useIotCommandExecution(null, true, "multispeq"));

      await expect(result.current.executeCommandCode([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });
  });

  describe("executeInlineCommand function", () => {
    it("throws when not connected", async () => {
      const { result } = renderHook(() => useIotCommandExecution(null, false, "multispeq"));
      await expect(result.current.executeInlineCommand("battery")).rejects.toThrow(
        "Not connected to device",
      );
    });

    it("sends a raw string command with a short timeout and parses the response", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true, data: '{"battery": 87}' });
      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeInlineCommand("battery");

      expect(mockExecute).toHaveBeenCalledWith("battery", { timeoutMs: 10_000 });
      expect(data).toEqual({ battery: 87 });
    });

    it("throws with the device error message on failure", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: { message: "Bad command" } });
      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      await expect(result.current.executeInlineCommand("nope")).rejects.toThrow("Bad command");
    });
  });

  describe("multispeq execution", () => {
    it("sends command JSON directly as a single command", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: { temperature: 25.5 } });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const commandCode = [{ command: "measure" }];
      const data = await result.current.executeCommandCode(commandCode);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(commandCode);
      expect(data).toEqual({ temperature: 25.5 });
    });

    it("throws error when execution fails", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: { message: "Device error" },
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Device error",
      );
    });

    it("uses default error message when error.message is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: {},
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Command execution failed",
      );
    });

    it("parses JSON string data from device", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: '{"temperature": 27.3}' });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toEqual({ temperature: 27.3 });
    });

    it("keeps string data as-is when JSON parsing fails", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true, data: "invalid json {}" });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toBe("invalid json {}");
    });

    it("returns non-string data without modification", async () => {
      const mockData = { raw: true, values: [1, 2, 3] };
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true, data: mockData });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toEqual(mockData);
    });
  });

  describe("generic/ambyte execution", () => {
    it("executes SET_CONFIG, RUN, GET_DATA steps in order", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true }) // SET_CONFIG
        .mockResolvedValueOnce({ success: true }) // RUN
        .mockResolvedValueOnce({ success: true, data: { temperature: 25.5 } }); // GET_DATA

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      const data = await result.current.executeCommandCode([{ command: "test" }]);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, {
        command: "SET_CONFIG",
        params: { command: [{ command: "test" }] },
      });
      expect(mockExecute).toHaveBeenNthCalledWith(2, { command: "RUN" });
      expect(mockExecute).toHaveBeenNthCalledWith(3, { command: "GET_DATA" });
      expect(data).toEqual({ temperature: 25.5 });
    });

    it("throws error when SET_CONFIG fails", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: { message: "Config error" },
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Config error",
      );
    });

    it("throws error when RUN fails", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          error: { message: "Run error" },
        });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Run error",
      );
    });

    it("throws error when GET_DATA fails", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          error: { message: "Data error" },
        });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Data error",
      );
    });

    it("parses JSON string data from device", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true, data: '{"temperature": 27.3, "humidity": 65}' });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toEqual({ temperature: 27.3, humidity: 65 });
    });

    it("keeps string data as-is when JSON parsing fails", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true, data: "invalid json {}" });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toBe("invalid json {}");
    });

    it("returns non-string data without modification", async () => {
      const mockData = { raw: true, values: [1, 2, 3] };
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true, data: mockData });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      const data = await result.current.executeCommandCode([{ command: "measure" }]);
      expect(data).toEqual(mockData);
    });

    it("uses default error messages when error.message is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: {},
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Failed to load command on device",
      );
    });

    it("uses default error message for RUN when error.message is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({
        success: false,
        error: {},
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Failed to run command",
      );
    });

    it("uses default error message for GET_DATA when error.message is undefined", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          error: {},
        });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotCommandExecution(mockDriver as IDeviceDriver, true, "ambyte"),
      );

      await expect(result.current.executeCommandCode([{ command: "test" }])).rejects.toThrow(
        "Failed to get measurement data",
      );
    });
  });
});
