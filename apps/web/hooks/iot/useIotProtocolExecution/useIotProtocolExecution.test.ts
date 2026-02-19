import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { IDeviceProtocol } from "@repo/iot";

import { useIotProtocolExecution } from "./useIotProtocolExecution";

describe("useIotProtocolExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeProtocol function", () => {
    it("provides executeProtocol function", () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, false));
      expect(typeof result.current.executeProtocol).toBe("function");
    });

    it("throws error when not connected", async () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, false));

      await expect(result.current.executeProtocol([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });

    it("throws error when protocol is null", async () => {
      const { result } = renderHook(() => useIotProtocolExecution(null, true));

      await expect(result.current.executeProtocol([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });

    it("executes protocol steps in order", async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({ success: true }) // SET_CONFIG
        .mockResolvedValueOnce({ success: true }) // RUN
        .mockResolvedValueOnce({ success: true, data: { temperature: 25.5 } }); // GET_DATA

      const mockProtocol: Partial<IDeviceProtocol> = {
        execute: mockExecute,
      };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockProtocol as IDeviceProtocol, true),
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

      const mockProtocol: Partial<IDeviceProtocol> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockProtocol as IDeviceProtocol, true),
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

      const mockProtocol: Partial<IDeviceProtocol> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockProtocol as IDeviceProtocol, true),
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

      const mockProtocol: Partial<IDeviceProtocol> = { execute: mockExecute };

      const { result } = renderHook(() =>
        useIotProtocolExecution(mockProtocol as IDeviceProtocol, true),
      );

      await expect(result.current.executeProtocol([{ command: "test" }])).rejects.toThrow(
        "Data error",
      );
    });
  });
});
