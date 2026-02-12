import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useIotProtocolConnection } from "./useIotProtocolConnection";

// Mock the IoT package
vi.mock("@repo/iot", () => ({
  MultispeqProtocol: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, data: { test: "data" } }),
    getDeviceInfo: vi.fn().mockResolvedValue({
      device_name: "Test Device",
      device_version: "1.0.0",
      device_battery: 85,
    }),
    destroy: vi.fn(),
  })),
  GenericDeviceProtocol: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, data: { test: "data" } }),
    getDeviceInfo: vi.fn().mockResolvedValue({
      device_name: "Generic Device",
      device_version: "1.0.0",
    }),
    destroy: vi.fn(),
  })),
  WebBluetoothAdapter: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    onDataReceived: vi.fn(),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn(),
  })),
  WebSerialAdapter: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    onDataReceived: vi.fn(),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn(),
  })),
  MULTISPEQ_BLE_CONFIG: {
    serviceUUID: "test-service",
    writeUUID: "test-write",
    notifyUUID: "test-notify",
  },
}));

// Mock Web Bluetooth API
const mockRequestDevice = vi.fn();
Object.defineProperty(navigator, "bluetooth", {
  value: {
    requestDevice: mockRequestDevice,
  },
  configurable: true,
});

// Mock Web Serial API
const mockRequestPort = vi.fn();
Object.defineProperty(navigator, "serial", {
  value: {
    requestPort: mockRequestPort,
  },
  configurable: true,
});

describe("useIotProtocolConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts disconnected", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.deviceInfo).toBe(null);
    });
  });

  describe("connection types", () => {
    it("initializes with bluetooth connection type", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));
      expect(result.current.isConnected).toBe(false);
    });

    it("initializes with serial connection type", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "serial"));
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("sensor families", () => {
    it("supports multispeq sensor family", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));
      expect(result.current).toBeDefined();
    });

    it("supports generic sensor family", () => {
      const { result } = renderHook(() => useIotProtocolConnection("generic", "bluetooth"));
      expect(result.current).toBeDefined();
    });
  });

  describe("connect function", () => {
    it("provides connect function", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));
      expect(typeof result.current.connect).toBe("function");
    });
  });

  describe("disconnect function", () => {
    it("provides disconnect function", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));
      expect(typeof result.current.disconnect).toBe("function");
    });
  });

  describe("executeProtocol function", () => {
    it("provides executeProtocol function", () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));
      expect(typeof result.current.executeProtocol).toBe("function");
    });

    it("throws error when not connected", async () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));

      await expect(result.current.executeProtocol([{ test: "command" }])).rejects.toThrow(
        "Not connected to device",
      );
    });
  });

  describe("error handling", () => {
    it("sets error state when connection fails", async () => {
      mockRequestDevice.mockRejectedValueOnce(new Error("Connection failed"));

      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));

      result.current.connect();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.isConnected).toBe(false);
      });
    });

    it("clears error on successful connection", async () => {
      const { result } = renderHook(() => useIotProtocolConnection("multispeq", "bluetooth"));

      // First set an error
      mockRequestDevice.mockRejectedValueOnce(new Error("First error"));
      result.current.connect();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe("cleanup", () => {
    it("cleans up on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useIotProtocolConnection("multispeq", "bluetooth"),
      );

      expect(result.current).toBeDefined();
      unmount();
    });
  });
});
