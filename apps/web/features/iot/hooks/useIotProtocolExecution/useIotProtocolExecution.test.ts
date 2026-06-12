import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { IDeviceDriver } from "@repo/iot";

import { useIotProtocolExecution } from "./useIotProtocolExecution";

describe("useIotProtocolExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeProtocol function", () => {
    it("provides executeProtocol function", () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, false, "multispeq"));
      expect(typeof result.current.executeProtocol).toBe("function");
    });

    it("throws error when not connected", async () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, false, "multispeq"));

      await expect(result.current.executeProtocol([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });

    it("throws error when driver is null", async () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, true, "multispeq"));

      await expect(result.current.executeProtocol([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });
  });

  describe("multispeq execution", () => {
    it("sends protocol JSON directly as a single command", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: { temperature: 25.5 } });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const protocolCode = [{ command: "measure" }];
      const data = await result.current.executeProtocol(protocolCode);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(protocolCode);
      expect(data).toEqual({ temperature: 25.5 });
    });

    it("throws error when execution fails", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: { message: "Device error" },
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
        "Protocol execution failed",
      );
    });

    it("parses JSON string data from device", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: '{"temperature": 27.3}' });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
      expect(data).toEqual({ temperature: 27.3 });
    });

    it("keeps string data as-is when JSON parsing fails", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true, data: "invalid json {}" });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
      expect(data).toBe("invalid json {}");
    });

    it("returns non-string data without modification", async () => {
      const mockData = { raw: true, values: [1, 2, 3] };
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true, data: mockData });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "multispeq"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
      expect(data).toEqual(mockData);
    });
  });

  describe("generic/ambit execution", () => {
    it("executes SET_CONFIG, RUN, GET_DATA steps in order", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true }) // SET_CONFIG
        .mockResolvedValueOnce({ success: true }) // RUN
        .mockResolvedValueOnce({ success: true, data: { temperature: 25.5 } }); // GET_DATA

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      const data = await result.current.executeProtocol([{ command: "test" }]);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, {
        command: "SET_CONFIG",
        params: { protocol: [{ command: "test" }] },
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      const data = await result.current.executeProtocol([{ command: "measure" }]);
      expect(data).toEqual(mockData);
    });

    it("uses default error messages when error.message is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({
        success: false,
        error: {},
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
        "Failed to load protocol on device",
      );
    });

    it("uses default error message for RUN when error.message is undefined", async () => {
      const mockExecute = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({
        success: false,
        error: {},
      });

      const mockDriver: Partial<IDeviceDriver> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
        "Failed to run protocol",
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
        useIotProtocolExecution(mockDriver as IDeviceDriver, true, "ambit"),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
        "Failed to get measurement data",
      );
    });
  });
});
