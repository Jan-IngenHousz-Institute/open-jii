/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../transport/interface";
import { DeviceProtocol } from "./base";
import type { CommandResult } from "./base";

// Concrete subclass for testing the abstract base class
class TestProtocol extends DeviceProtocol {
  async execute<T = unknown>(_command: string | object): Promise<CommandResult<T>> {
    this.ensureInitialized();
    return Promise.resolve({ success: true, data: "test" as unknown as T });
  }

  // Expose protected method for testing
  public testEnsureInitialized(): void {
    this.ensureInitialized();
  }
}

function createMockTransport(): ITransportAdapter {
  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn(),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DeviceProtocol", () => {
  let protocol: TestProtocol;
  let transport: ITransportAdapter;

  beforeEach(() => {
    protocol = new TestProtocol();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set transport and mark as initialized", () => {
      protocol.initialize(transport);

      // Should not throw after initialization
      expect(() => protocol.testEnsureInitialized()).not.toThrow();
    });
  });

  describe("ensureInitialized", () => {
    it("should throw when not initialized", () => {
      expect(() => protocol.testEnsureInitialized()).toThrow(
        "Protocol not initialized. Call initialize() first.",
      );
    });

    it("should not throw after initialization", () => {
      protocol.initialize(transport);
      expect(() => protocol.testEnsureInitialized()).not.toThrow();
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(protocol.execute("test")).rejects.toThrow(
        "Protocol not initialized. Call initialize() first.",
      );
    });

    it("should succeed when initialized", async () => {
      protocol.initialize(transport);
      const result = await protocol.execute("test");
      expect(result.success).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should disconnect transport and mark as uninitialized", async () => {
      protocol.initialize(transport);
      await protocol.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
      expect(() => protocol.testEnsureInitialized()).toThrow();
    });

    it("should handle destroy when not initialized", async () => {
      // Should not throw
      await expect(protocol.destroy()).resolves.toBeUndefined();
    });
  });
});
