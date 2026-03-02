/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../transport/interface";
import { DeviceDriver } from "./driver-base";
import type { CommandResult } from "./driver-base";

// Concrete subclass for testing the abstract base class
class TestDriver extends DeviceDriver {
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

describe("DeviceDriver", () => {
  let driver: TestDriver;
  let transport: ITransportAdapter;

  beforeEach(() => {
    driver = new TestDriver();
    transport = createMockTransport();
  });

  describe("initialize", () => {
    it("should set transport and mark as initialized", () => {
      driver.initialize(transport);

      // Should not throw after initialization
      expect(() => driver.testEnsureInitialized()).not.toThrow();
    });
  });

  describe("ensureInitialized", () => {
    it("should throw when not initialized", () => {
      expect(() => driver.testEnsureInitialized()).toThrow(
        "Driver not initialized. Call initialize() first.",
      );
    });

    it("should not throw after initialization", () => {
      driver.initialize(transport);
      expect(() => driver.testEnsureInitialized()).not.toThrow();
    });
  });

  describe("execute", () => {
    it("should throw when not initialized", async () => {
      await expect(driver.execute("test")).rejects.toThrow(
        "Driver not initialized. Call initialize() first.",
      );
    });

    it("should succeed when initialized", async () => {
      driver.initialize(transport);
      const result = await driver.execute("test");
      expect(result.success).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should disconnect transport and mark as uninitialized", async () => {
      driver.initialize(transport);
      await driver.destroy();

      expect(transport.disconnect).toHaveBeenCalled();
      expect(() => driver.testEnsureInitialized()).toThrow();
    });

    it("should handle destroy when not initialized", async () => {
      // Should not throw
      await expect(driver.destroy()).resolves.toBeUndefined();
    });
  });
});
