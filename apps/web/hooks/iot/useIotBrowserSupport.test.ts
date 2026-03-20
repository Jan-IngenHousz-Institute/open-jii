import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
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
  });
});
