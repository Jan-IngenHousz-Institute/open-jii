import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useIotCommunication } from "./useIotCommunication";

// Mock the IoT package
vi.mock("@repo/iot", () => ({
  MultispeqDriver: vi.fn(function () {
    return {
      initialize: vi.fn(),
      execute: vi.fn().mockResolvedValue({ success: true, data: { test: "data" } }),
      getDeviceInfo: vi.fn().mockResolvedValue({
        device_name: "Test Device",
        device_version: "1.0.0",
        device_battery: 85,
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
  }),
  GenericDeviceDriver: vi.fn(function () {
    return {
      initialize: vi.fn(),
      execute: vi.fn().mockResolvedValue({ success: true, data: { test: "data" } }),
      getDeviceInfo: vi.fn().mockResolvedValue({
        device_name: "Generic Device",
        device_version: "1.0.0",
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
  }),
  GENERIC_BLE_UUIDS: {
    SERVICE: "generic-service",
    WRITE: "generic-write",
    NOTIFY: "generic-notify",
  },
  GENERIC_SERIAL_DEFAULTS: {
    baudRate: 115200,
  },
  MULTISPEQ_SERIAL_DEFAULTS: {
    baudRate: 115200,
  },
  isTransportSupported: vi.fn((deviceType: string, transport: string) => {
    if (deviceType === "multispeq" && transport === "bluetooth") return false;
    return true;
  }),
}));

// Mock device-type-mapping (web-layer mapping from SensorFamily to DeviceType)
vi.mock("../device-type-mapping", () => ({
  sensorFamilyToDeviceType: (family: string) =>
    family === "multispeq" ? ("multispeq" as const) : ("generic" as const),
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

    it("supports ambit sensor family", () => {
      const { result } = renderHook(() => useIotCommunication("ambit", "bluetooth"));
      expect(result.current).toBeDefined();
    });
  });

  describe("connect function", () => {
    it("provides connect function", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(typeof result.current.connect).toBe("function");
    });

    it("errors when connecting multispeq via bluetooth (BLE not supported)", async () => {
      // The hook logs the thrown connection error via console.error; expected here.
      vi.spyOn(console, "error").mockImplementation(() => {
        // no-op
      });

      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).toMatch(/does not support bluetooth transport/);
      });
    });

    it("successfully connects via serial with multispeq (skips getDeviceInfo)", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "serial"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.deviceInfo).toBe(null);
        expect(result.current.driver).not.toBeNull();
      });
    });

    it("successfully connects with ambit sensor family via bluetooth", async () => {
      const { result } = renderHook(() => useIotCommunication("ambit", "bluetooth"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.driver).not.toBeNull();
      });
    });

    it("successfully connects with ambit sensor family via serial", async () => {
      const { result } = renderHook(() => useIotCommunication("ambit", "serial"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.driver).not.toBeNull();
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

    it("clears state when driver is null", () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));
      expect(result.current.driver).toBe(null);
      expect(result.current.deviceInfo).toBe(null);
    });
  });

  describe("disconnect function", () => {
    it("disconnects successfully", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "serial"));

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

    it("disconnects when driver is null", async () => {
      const { result } = renderHook(() => useIotCommunication("multispeq", "bluetooth"));

      await result.current.disconnect();

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("device disconnect", () => {
    it("resets state when device disconnects via transport status change", async () => {
      // The hook logs the disconnect via console.debug; expected here.
      vi.spyOn(console, "debug").mockImplementation(() => {
        // no-op
      });

      // Capture the onStatusChanged callback so we can trigger it
      let statusCallback: ((connected: boolean, error?: Error) => void) | undefined;
      const { WebSerialAdapter } = await import("@repo/iot/transport/web");

      vi.mocked(WebSerialAdapter.requestAndConnect).mockResolvedValue({
        isConnected: vi.fn().mockReturnValue(true),
        send: vi.fn(),
        onDataReceived: vi.fn(),
        onStatusChanged: vi.fn((cb: (connected: boolean, error?: Error) => void) => {
          statusCallback = cb;
        }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      });

      const { result } = renderHook(() => useIotCommunication("multispeq", "serial"));

      void result.current.connect();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate device disconnect
      statusCallback?.(false, new Error("Device removed"));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.driver).toBe(null);
        expect(result.current.error).toBe("Device removed");
      });
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
