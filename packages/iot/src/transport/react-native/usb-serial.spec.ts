/* eslint-disable @typescript-eslint/unbound-method */
import type { UsbSerial } from "react-native-usb-serialport-for-android";
import { UsbSerialManager } from "react-native-usb-serialport-for-android";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toHex, fromHex } from "../../utils/hex";
import { RNUSBSerialAdapter } from "./usb-serial";

vi.mock("react-native-usb-serialport-for-android", () => ({
  UsbSerialManager: {
    hasPermission: vi.fn(),
    tryRequestPermission: vi.fn(),
    open: vi.fn(),
  },
  Parity: {
    None: 0,
    Odd: 1,
    Even: 2,
  },
}));

// Mock delay so we don't actually wait 2s in tests
vi.mock("../../utils/async", () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock helpers ---

function createMockPort() {
  let receiveCallback: ((event: { data: string }) => void) | undefined;

  const port = {
    send: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onReceived: vi.fn((cb: (event: { data: string }) => void) => {
      receiveCallback = cb;
    }),
    // Test helper
    simulateReceive(plainText: string) {
      const hexData = toHex(plainText);
      receiveCallback?.({ data: hexData });
    },
  };

  return port;
}

// --- Tests ---

describe("RNUSBSerialAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set up onReceived listener", () => {
      const port = createMockPort();
      new RNUSBSerialAdapter(port as unknown as UsbSerial);
      expect(port.onReceived).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("send", () => {
    it("should hex-encode data before sending", async () => {
      const port = createMockPort();
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);

      await adapter.send("hello");

      expect(port.send).toHaveBeenCalledWith(toHex("hello"));
    });

    it("should throw when port is null", async () => {
      const port = createMockPort();
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);
      // @ts-expect-error testing private field
      adapter.port = null;

      await expect(adapter.send("test")).rejects.toThrow("Port not initialized");
    });
  });

  describe("onDataReceived", () => {
    it("should hex-decode incoming data and invoke callback", () => {
      const port = createMockPort();
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);

      const cb = vi.fn();
      adapter.onDataReceived(cb);

      port.simulateReceive("test data");

      expect(cb).toHaveBeenCalledWith("test data");
    });

    it("should handle hex data directly (fromHex roundtrip)", () => {
      const port = createMockPort();
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);

      const cb = vi.fn();
      adapter.onDataReceived(cb);

      // Verify the hex encoding/decoding roundtrip
      const original = "Hello World!";
      const hex = toHex(original);
      expect(fromHex(hex)).toBe(original);

      port.simulateReceive(original);
      expect(cb).toHaveBeenCalledWith(original);
    });

    it("should catch hex decode errors gracefully", () => {
      const port = createMockPort();
      new RNUSBSerialAdapter(port as unknown as UsbSerial);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Simulate receiving invalid hex (odd length) that causes fromHex to throw
      const rawCallback = port.onReceived.mock.calls[0]?.[0] as (event: { data: string }) => void;
      rawCallback({ data: "Z" });

      expect(consoleSpy).toHaveBeenCalledWith("Error decoding hex data:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("disconnect", () => {
    it("should close port and update status", async () => {
      const port = createMockPort();
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(port.close).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });

    it("should handle close error gracefully", async () => {
      const port = createMockPort();
      port.close.mockRejectedValue(new Error("close failed"));
      const adapter = new RNUSBSerialAdapter(port as unknown as UsbSerial);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await adapter.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith("Error disconnecting:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("connect", () => {
    it("should request permission and open port", async () => {
      const port = createMockPort();
      vi.mocked(UsbSerialManager.hasPermission).mockResolvedValue(true);
      vi.mocked(UsbSerialManager.open).mockResolvedValue(port as never);

      const adapter = await RNUSBSerialAdapter.connect(42);

      expect(UsbSerialManager.hasPermission).toHaveBeenCalledWith(42);
      expect(UsbSerialManager.open).toHaveBeenCalledWith(42, {
        baudRate: 115200,
        dataBits: 8,
        parity: 0, // Parity.None
        stopBits: 1,
      });
      expect(adapter.isConnected()).toBe(true);
    });

    it("should retry permission request until granted", async () => {
      const port = createMockPort();
      vi.mocked(UsbSerialManager.hasPermission)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      vi.mocked(UsbSerialManager.tryRequestPermission)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      vi.mocked(UsbSerialManager.open).mockResolvedValue(port as never);

      const adapter = await RNUSBSerialAdapter.connect(42);

      // First loop: hasPermission=false, tryRequestPermission=false → delay
      // Second loop: hasPermission=false, tryRequestPermission=false → delay
      // Third loop: hasPermission=true → break
      expect(UsbSerialManager.hasPermission).toHaveBeenCalledTimes(3);
      expect(UsbSerialManager.tryRequestPermission).toHaveBeenCalledTimes(2);
      expect(adapter.isConnected()).toBe(true);
    });

    it("should break on tryRequestPermission success", async () => {
      const port = createMockPort();
      vi.mocked(UsbSerialManager.hasPermission).mockResolvedValue(false);
      vi.mocked(UsbSerialManager.tryRequestPermission).mockResolvedValueOnce(true);
      vi.mocked(UsbSerialManager.open).mockResolvedValue(port as never);

      const adapter = await RNUSBSerialAdapter.connect(42);

      expect(UsbSerialManager.hasPermission).toHaveBeenCalledTimes(1);
      expect(UsbSerialManager.tryRequestPermission).toHaveBeenCalledTimes(1);
      expect(adapter.isConnected()).toBe(true);
    });
  });
});
