/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { IDeviceProtocol, CommandResult } from "../protocol/base";
import type { ITransportAdapter } from "../transport/interface";
import { CommandExecutor } from "./command-executor";

function createMockTransport(): ITransportAdapter {
  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn(),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockProtocol(): IDeviceProtocol {
  return {
    initialize: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, data: "result" }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("CommandExecutor", () => {
  let protocol: IDeviceProtocol;
  let transport: ITransportAdapter;

  beforeEach(() => {
    protocol = createMockProtocol();
    transport = createMockTransport();
  });

  it("should initialize protocol with transport on construction", () => {
    new CommandExecutor(protocol, transport);
    expect(protocol.initialize).toHaveBeenCalledWith(transport);
  });

  describe("execute", () => {
    it("should execute a string command and return data", async () => {
      vi.mocked(protocol.execute).mockResolvedValue({
        success: true,
        data: { value: 42 },
      });

      const executor = new CommandExecutor(protocol, transport);
      const result = await executor.execute<{ value: number }>("test-command");

      expect(protocol.execute).toHaveBeenCalledWith("test-command");
      expect(result).toEqual({ value: 42 });
    });

    it("should execute an object command", async () => {
      const cmd = { command: "RUN", params: { speed: 5 } };
      vi.mocked(protocol.execute).mockResolvedValue({
        success: true,
        data: "ok",
      });

      const executor = new CommandExecutor(protocol, transport);
      await executor.execute(cmd);

      expect(protocol.execute).toHaveBeenCalledWith(cmd);
    });

    it("should throw the protocol error when execution fails", async () => {
      const error = new Error("Device error");
      vi.mocked(protocol.execute).mockResolvedValue({
        success: false,
        error,
      });

      const executor = new CommandExecutor(protocol, transport);
      await expect(executor.execute("fail")).rejects.toThrow("Device error");
    });

    it("should throw generic error when execution fails without error object", async () => {
      vi.mocked(protocol.execute).mockResolvedValue({
        success: false,
      } as CommandResult);

      const executor = new CommandExecutor(protocol, transport);
      await expect(executor.execute("fail")).rejects.toThrow("Command execution failed");
    });
  });

  describe("destroy", () => {
    it("should call protocol destroy", async () => {
      const executor = new CommandExecutor(protocol, transport);
      await executor.destroy();

      expect(protocol.destroy).toHaveBeenCalled();
    });
  });
});
