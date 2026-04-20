import { renderHook } from "@/test/test-utils";
import { describe, expect, it, afterEach } from "vitest";

import { useIotBrowserSupport } from "./useIotBrowserSupport";

describe("useIotBrowserSupport", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("returns all false when neither bluetooth nor serial is available", () => {
    // navigator exists but without bluetooth/serial
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "test" },
      configurable: true,
    });

    const { result } = renderHook(() => useIotBrowserSupport());

    expect(result.current.bluetooth).toBe(false);
    expect(result.current.serial).toBe(false);
    expect(result.current.any).toBe(false);
    expect(result.current.bluetoothReason).toBe("browser");
    expect(result.current.serialReason).toBe("browser");
  });

  it("detects bluetooth support", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { bluetooth: {}, userAgent: "test" },
      configurable: true,
    });

    const { result } = renderHook(() => useIotBrowserSupport());

    expect(result.current.bluetooth).toBe(true);
    expect(result.current.serial).toBe(false);
    expect(result.current.any).toBe(true);
    expect(result.current.bluetoothReason).toBeNull();
    expect(result.current.serialReason).toBe("browser");
  });

  it("detects serial support", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { serial: {}, userAgent: "test" },
      configurable: true,
    });

    const { result } = renderHook(() => useIotBrowserSupport());

    expect(result.current.bluetooth).toBe(false);
    expect(result.current.serial).toBe(true);
    expect(result.current.any).toBe(true);
    expect(result.current.bluetoothReason).toBe("browser");
    expect(result.current.serialReason).toBeNull();
  });

  it("detects both bluetooth and serial support", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { bluetooth: {}, serial: {}, userAgent: "test" },
      configurable: true,
    });

    const { result } = renderHook(() => useIotBrowserSupport());

    expect(result.current.bluetooth).toBe(true);
    expect(result.current.serial).toBe(true);
    expect(result.current.any).toBe(true);
    expect(result.current.bluetoothReason).toBeNull();
    expect(result.current.serialReason).toBeNull();
  });

  describe("with sensorFamily filtering", () => {
    it("disables bluetooth for multispeq with 'device' reason", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { bluetooth: {}, serial: {}, userAgent: "test" },
        configurable: true,
      });

      const { result } = renderHook(() => useIotBrowserSupport("multispeq"));

      expect(result.current.bluetooth).toBe(false);
      expect(result.current.bluetoothReason).toBe("device");
      expect(result.current.serial).toBe(true);
      expect(result.current.serialReason).toBeNull();
      expect(result.current.any).toBe(true);
    });

    it("keeps bluetooth enabled for generic devices", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { bluetooth: {}, serial: {}, userAgent: "test" },
        configurable: true,
      });

      const { result } = renderHook(() => useIotBrowserSupport("generic"));

      expect(result.current.bluetooth).toBe(true);
      expect(result.current.bluetoothReason).toBeNull();
      expect(result.current.serial).toBe(true);
      expect(result.current.any).toBe(true);
    });

    it("keeps bluetooth enabled for ambit devices", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { bluetooth: {}, serial: {}, userAgent: "test" },
        configurable: true,
      });

      const { result } = renderHook(() => useIotBrowserSupport("ambit"));

      expect(result.current.bluetooth).toBe(true);
      expect(result.current.serial).toBe(true);
      expect(result.current.any).toBe(true);
    });

    it("returns 'device' reason for bluetooth and 'browser' for serial on multispeq with only bluetooth", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { bluetooth: {}, userAgent: "test" },
        configurable: true,
      });

      const { result } = renderHook(() => useIotBrowserSupport("multispeq"));

      expect(result.current.bluetooth).toBe(false);
      expect(result.current.bluetoothReason).toBe("device");
      expect(result.current.serial).toBe(false);
      expect(result.current.serialReason).toBe("browser");
      expect(result.current.any).toBe(false);
    });
  });
});
