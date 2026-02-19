import type { BleManager, Device } from "react-native-ble-plx";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RNBLEAdapter } from "./ble";
import type { RNBLEConfig } from "./ble";

vi.mock("react-native-ble-plx", () => ({
  BleManager: vi.fn(),
}));

const DEFAULT_CONFIG: RNBLEConfig = {
  serviceUUID: "0000ffe0-0000-1000-8000-00805f9b34fb",
  writeUUID: "0000ffe1-0000-1000-8000-00805f9b34fb",
  notifyUUID: "0000ffe2-0000-1000-8000-00805f9b34fb",
};

// --- Mock helpers ---

function createMockDevice() {
  let monitorCallback:
    | ((error: Error | null, characteristic: { value: string | null } | null) => void)
    | undefined;

  const device = {
    id: "ble-device-123",
    name: "Test BLE Device",
    discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValue(undefined),
    monitorCharacteristicForService: vi.fn(
      (
        _serviceUUID: string,
        _charUUID: string,
        callback: (error: Error | null, characteristic: { value: string | null } | null) => void,
      ) => {
        monitorCallback = callback;
      },
    ),
    writeCharacteristicWithResponseForService: vi.fn().mockResolvedValue(undefined),
    cancelConnection: vi.fn().mockResolvedValue(undefined),
    // Test helper – simulate BLE notification with base64-encoded data
    simulateNotification(plainText: string) {
      const base64 = btoa(plainText);
      monitorCallback?.(null, { value: base64 });
    },
    simulateError(error: Error) {
      monitorCallback?.(error, null);
    },
  };

  return device;
}

function createMockBleManager() {
  return {
    connectToDevice: vi.fn(),
    destroy: vi.fn(),
  };
}

// --- Tests ---

describe("RNBLEAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("send", () => {
    it("should base64-encode and write data", async () => {
      const device = createMockDevice();
      const adapter = new RNBLEAdapter(device as unknown as Device, DEFAULT_CONFIG);
      await adapter.send("hello");

      expect(device.writeCharacteristicWithResponseForService).toHaveBeenCalledWith(
        DEFAULT_CONFIG.serviceUUID,
        DEFAULT_CONFIG.writeUUID,
        btoa("hello"),
      );
    });

    it("should throw when device is null", async () => {
      const device = createMockDevice();
      const adapter = new RNBLEAdapter(device as unknown as Device, DEFAULT_CONFIG);
      // @ts-expect-error testing private field
      adapter.device = null;

      await expect(adapter.send("test")).rejects.toThrow("Device not initialized");
    });
  });

  describe("notification handling", () => {
    it("should buffer and deliver complete __EOM__ messages", async () => {
      const device = createMockDevice();
      const bleManager = createMockBleManager();
      bleManager.connectToDevice.mockResolvedValue(device);

      const adapter = await RNBLEAdapter.connect(
        "ble-id",
        bleManager as unknown as BleManager,
        DEFAULT_CONFIG,
      );

      const dataCb = vi.fn();
      adapter.onDataReceived(dataCb);

      // Send data in chunks
      device.simulateNotification("Hello ");
      expect(dataCb).not.toHaveBeenCalled();

      device.simulateNotification("World__EOM__");
      expect(dataCb).toHaveBeenCalledWith("Hello World");
    });

    it("should deliver single complete message", async () => {
      const device = createMockDevice();
      const bleManager = createMockBleManager();
      bleManager.connectToDevice.mockResolvedValue(device);

      const adapter = await RNBLEAdapter.connect(
        "ble-id",
        bleManager as unknown as BleManager,
        DEFAULT_CONFIG,
      );

      const dataCb = vi.fn();
      adapter.onDataReceived(dataCb);

      device.simulateNotification("complete__EOM__");
      expect(dataCb).toHaveBeenCalledWith("complete");
    });
  });

  describe("disconnect", () => {
    it("should cancel connection and update status", async () => {
      const device = createMockDevice();
      const adapter = new RNBLEAdapter(device as unknown as Device, DEFAULT_CONFIG);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(device.cancelConnection).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });
  });

  describe("connect", () => {
    it("should connect device, setup notifications and return adapter", async () => {
      const device = createMockDevice();
      const bleManager = createMockBleManager();
      bleManager.connectToDevice.mockResolvedValue(device);

      const adapter = await RNBLEAdapter.connect(
        "ble-id",
        bleManager as unknown as BleManager,
        DEFAULT_CONFIG,
      );

      expect(bleManager.connectToDevice).toHaveBeenCalledWith("ble-id", {
        timeout: 10000,
      });
      expect(device.discoverAllServicesAndCharacteristics).toHaveBeenCalled();
      expect(device.monitorCharacteristicForService).toHaveBeenCalledWith(
        DEFAULT_CONFIG.serviceUUID,
        DEFAULT_CONFIG.notifyUUID,
        expect.any(Function),
      );
      expect(adapter.isConnected()).toBe(true);
    });
  });
});
