/* eslint-disable @typescript-eslint/unbound-method */
import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useIotCommunication } from "./useIotCommunication";

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
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
  GenericDeviceProtocol: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, data: { test: "data" } }),
    getDeviceInfo: vi.fn().mockResolvedValue({
      device_name: "Generic Device",
      device_version: "1.0.0",
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
  MULTISPEQ_BLE_UUIDS: {
    SERVICE: "test-service",
    WRITE: "test-write",
    NOTIFY: "test-notify",
  },
  GENERIC_BLE_UUIDS: {
    SERVICE: "generic-service",
    WRITE: "generic-write",
    NOTIFY: "generic-notify",
  },
  GENERIC_SERIAL_DEFAULTS: {
    baudRate: 115200,
  },
}));

// Mock transport adapters
vi.mock("@repo/iot/transport/web", () => ({
  WebBluetoothAdapter: {
    requestAndConnect: vi.fn().mockResolvedValue({
      isConnected: vi.fn().mockReturnValue(true),
      send: vi.fn(),
      onDataReceived: vi.fn(),
      onStatusChanged: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  },
  WebSerialAdapter: {
    requestAndConnect: vi.fn().mockResolvedValue({
      isConnected: vi.fn().mockReturnValue(true),
      send: vi.fn(),
      onDataReceived: vi.fn(),
      onStatusChanged: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe("useIotCommunication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts disconnected", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.deviceInfo).toBe(null);
    });
  });

  describe("connection types", () => {
    it("initializes with bluetooth connection type", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(result.current.isConnected).toBe(false);
    });

    it("initializes with serial connection type", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "serial"));
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("sensor families", () => {
    it("supports multispeq sensor family", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(result.current).toBeDefined();
    });

    it("supports generic sensor family", () => {
      const { result } = renderHook(() => useIotCommunication("generic", "bluetooth"));
      expect(result.current).toBeDefined();
    });
  });

  describe("connect function", () => {
    it("provides connect function", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(typeof result.current.connect).toBe("function");
    });

    it("successfully connects via bluetooth with multispeq", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.deviceInfo).toEqual({
          device_name: "Test Device",
          device_version: "1.0.0",
          device_battery: 85,
        });
        expect(result.current.protocol).not.toBeNull();
      });
    });

    it("successfully connects via serial with multispeq", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "serial"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.protocol).not.toBeNull();
      });
    });

    it("successfully connects with generic sensor family", async () => {
      const { result } = renderHook(() => useIotCommunication("generic", "bluetooth"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.deviceInfo).toEqual({
          device_name: "Generic Device",
          device_version: "1.0.0",
        });
        expect(result.current.protocol).not.toBeNull();
      });
    });

    it("successfully connects via serial with generic sensor family", async () => {
      const { result } = renderHook(() => useIotCommunication("generic", "serial"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.protocol).not.toBeNull();
      });
    });
  });

  describe("disconnect function", () => {
    it("provides disconnect function", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(typeof result.current.disconnect).toBe("function");
    });
  });

  describe("error handling", () => {
    it("starts with no error", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(result.current.error).toBe(null);
    });

    it("clears state when protocol is null", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(result.current.protocol).toBe(null);
      expect(result.current.deviceInfo).toBe(null);
    });
  });

  describe("disconnect function", () => {
    it("disconnects successfully", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await result.current.disconnect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.deviceInfo).toBe(null);
        expect(result.current.error).toBe(null);
      });
    });

    it("disconnects when protocol is null", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      await result.current.disconnect();

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("cleans up when not connected", () => {
      const { result, unmount } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      expect(result.current.isConnected).toBe(false);
      unmount();
    });
  });
});
