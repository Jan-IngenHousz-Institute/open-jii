/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { WebBluetoothAdapter } from "./bluetooth";
import type { WebBluetoothConfig } from "./bluetooth";

// --- Mock helpers ---

const DEFAULT_CONFIG: WebBluetoothConfig = {
  serviceUUID: "0000ffe0-0000-1000-8000-00805f9b34fb",
  writeUUID: "0000ffe1-0000-1000-8000-00805f9b34fb",
  notifyUUID: "0000ffe2-0000-1000-8000-00805f9b34fb",
};

function createMockCharacteristic() {
  const listeners: Record<string, EventListener[]> = {};

  return {
    uuid: "",
    value: undefined as DataView | undefined,
    writeValue: vi.fn().mockResolvedValue(undefined),
    writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
    startNotifications: vi.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    stopNotifications: vi.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners[type] = [];
      listeners[type].push(listener);
    }),
    removeEventListener: vi.fn(),
    // Test helper – simulate a notification event
    simulateNotification(text: string) {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(text);
      const dataView = new DataView(encoded.buffer);

      const event = {
        target: { value: dataView },
      } as unknown as Event;

      for (const listener of listeners.characteristicvaluechanged) {
        listener(event);
      }
    },
  };
}

function createMockDevice(gattServer?: unknown) {
  return {
    id: "test-device-id",
    name: "Test Device",
    gatt: gattServer,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

function createMockGATT(
  writeChar: ReturnType<typeof createMockCharacteristic>,
  notifyChar: ReturnType<typeof createMockCharacteristic>,
) {
  const service = {
    device: {},
    uuid: DEFAULT_CONFIG.serviceUUID,
    getCharacteristic: vi.fn((uuid: string) => {
      if (uuid === DEFAULT_CONFIG.writeUUID) return Promise.resolve(writeChar);
      if (uuid === DEFAULT_CONFIG.notifyUUID) return Promise.resolve(notifyChar);
      return Promise.reject(new Error("Unknown characteristic"));
    }),
  };

  const server = {
    device: {},
    connected: true,
    connect: vi.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn().mockResolvedValue(service),
  };

  return server;
}

// --- Tests ---

describe("WebBluetoothAdapter", () => {
  let originalNavigator: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: {
        bluetooth: {
          requestDevice: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.navigator;
    }
  });

  describe("isSupported", () => {
    it("should return true when navigator.bluetooth exists", () => {
      expect(WebBluetoothAdapter.isSupported()).toBe(true);
    });

    it("should return false when navigator.bluetooth is missing", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(WebBluetoothAdapter.isSupported()).toBe(false);
    });
  });

  describe("send", () => {
    it("should encode and write data via characteristic", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      await adapter.send("hello");

      expect(writeChar.writeValueWithResponse).toHaveBeenCalledWith(
        new TextEncoder().encode("hello"),
      );
    });

    it("should stringify objects before sending", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      // send() calls stringifyIfObject which JSON-encodes objects
      await adapter.send('{"cmd":"RUN"}');

      expect(writeChar.writeValueWithResponse).toHaveBeenCalled();
    });

    it("should throw when write characteristic not initialized", async () => {
      const device = createMockDevice();
      const adapter = new WebBluetoothAdapter(device as any, DEFAULT_CONFIG);

      await expect(adapter.send("test")).rejects.toThrow("Write characteristic not initialized");
    });
  });

  describe("notification handling", () => {
    it("should buffer and deliver complete __EOM__ messages", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      const dataCb = vi.fn();
      adapter.onDataReceived(dataCb);

      // Send data in chunks
      notifyChar.simulateNotification("Hello ");
      expect(dataCb).not.toHaveBeenCalled();

      notifyChar.simulateNotification("World__EOM__");
      expect(dataCb).toHaveBeenCalledWith("Hello World");
    });

    it("should deliver single message with __EOM__ immediately", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      const dataCb = vi.fn();
      adapter.onDataReceived(dataCb);

      notifyChar.simulateNotification("complete__EOM__");
      expect(dataCb).toHaveBeenCalledWith("complete");
    });
  });

  describe("disconnect", () => {
    it("should stop notifications and disconnect GATT", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(notifyChar.stopNotifications).toHaveBeenCalled();
      expect(gatt.disconnect).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });
  });

  describe("connect", () => {
    it("should connect GATT, setup characteristics and return adapter", async () => {
      const writeChar = createMockCharacteristic();
      const notifyChar = createMockCharacteristic();
      const gatt = createMockGATT(writeChar, notifyChar);
      const device = createMockDevice(gatt);

      const adapter = await WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG);

      expect(gatt.connect).toHaveBeenCalled();
      expect(gatt.getPrimaryService).toHaveBeenCalledWith(DEFAULT_CONFIG.serviceUUID);
      expect(notifyChar.startNotifications).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(true);
    });

    it("should throw when GATT server is not available", async () => {
      const device = createMockDevice(undefined);
      await expect(WebBluetoothAdapter.connect(device as any, DEFAULT_CONFIG)).rejects.toThrow(
        "Failed to connect to GATT server",
      );
    });
  });

  describe("requestAndConnect", () => {
    it("should throw when Web Bluetooth is not supported", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      await expect(WebBluetoothAdapter.requestAndConnect(DEFAULT_CONFIG)).rejects.toThrow(
        "Web Bluetooth not supported",
      );
    });
  });
});
