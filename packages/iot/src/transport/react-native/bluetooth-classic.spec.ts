/* eslint-disable @typescript-eslint/unbound-method */
import type { BluetoothDevice } from "react-native-bluetooth-classic";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RNBluetoothClassicAdapter } from "./bluetooth-classic";

vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    connectToDevice: vi.fn(),
    getConnectedDevice: vi.fn(),
  },
}));

// --- Mock helpers ---

function createMockDevice() {
  let dataCallback: ((event: { data: string }) => void) | undefined;

  const device = {
    id: "device-123",
    name: "Test BT Device",
    write: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn((cb: (event: { data: string }) => void) => {
      dataCallback = cb;
    }),
    // Test helper
    simulateData(data: string) {
      dataCallback?.({ data });
    },
  };

  return device;
}

// --- Tests ---

describe("RNBluetoothClassicAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set up data listener on device", () => {
      const device = createMockDevice();
      new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);
      expect(device.onDataReceived).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("send", () => {
    it("should call device.write with data", async () => {
      const device = createMockDevice();
      const adapter = new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);
      await adapter.send("hello");
      expect(device.write).toHaveBeenCalledWith("hello");
    });

    it("should throw when write returns false", async () => {
      const device = createMockDevice();
      device.write.mockResolvedValue(false);
      const adapter = new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);

      await expect(adapter.send("test")).rejects.toThrow("Failed to write to device");
    });

    it("should throw when device is null", async () => {
      const device = createMockDevice();
      const adapter = new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);
      // @ts-expect-error testing private field
      adapter.device = null;

      await expect(adapter.send("test")).rejects.toThrow("Device not initialized");
    });
  });

  describe("onDataReceived", () => {
    it("should invoke registered callback when data arrives", () => {
      const device = createMockDevice();
      const adapter = new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);

      const cb = vi.fn();
      adapter.onDataReceived(cb);

      device.simulateData("incoming data");
      expect(cb).toHaveBeenCalledWith("incoming data");
    });
  });

  describe("disconnect", () => {
    it("should disconnect device and update status", async () => {
      const device = createMockDevice();
      const adapter = new RNBluetoothClassicAdapter(device as unknown as BluetoothDevice);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(device.disconnect).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });
  });

  describe("connect", () => {
    it("should connect to device and return adapter", async () => {
      const device = createMockDevice();
      vi.mocked(RNBluetoothClassic.connectToDevice).mockResolvedValue(undefined as never);
      vi.mocked(RNBluetoothClassic.getConnectedDevice).mockResolvedValue(device as never);

      const adapter = await RNBluetoothClassicAdapter.connect("device-123");

      expect(RNBluetoothClassic.connectToDevice).toHaveBeenCalledWith("device-123");
      expect(RNBluetoothClassic.getConnectedDevice).toHaveBeenCalledWith("device-123");
      expect(adapter.isConnected()).toBe(true);
    });

    it("should retry on initial connection failure", async () => {
      const device = createMockDevice();
      vi.mocked(RNBluetoothClassic.connectToDevice)
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(undefined as never);
      vi.mocked(RNBluetoothClassic.getConnectedDevice).mockResolvedValue(device as never);

      const adapter = await RNBluetoothClassicAdapter.connect("device-123");

      expect(RNBluetoothClassic.connectToDevice).toHaveBeenCalledTimes(2);
      expect(adapter.isConnected()).toBe(true);
    });
  });
});
