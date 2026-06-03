// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOtaUpdate } from "~/features/profile/hooks/use-ota-update";

const mocks = vi.hoisted(() => ({
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("expo-updates", () => ({
  checkForUpdateAsync: mocks.checkForUpdateAsync,
  fetchUpdateAsync: mocks.fetchUpdateAsync,
  reloadAsync: mocks.reloadAsync,
}));

vi.mock("sonner-native", () => ({
  toast: {
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

vi.stubGlobal("__DEV__", false);

describe("useOtaUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("__DEV__", false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does nothing in dev mode", () => {
    vi.stubGlobal("__DEV__", true);
    renderHook(() => useOtaUpdate());
    expect(mocks.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("checks for update on mount in production", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    const { unmount } = renderHook(() => useOtaUpdate());
    await vi.runAllTimersAsync();
    expect(mocks.checkForUpdateAsync).toHaveBeenCalledOnce();
    unmount();
  });

  it("shows no toast when no update available", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    const { unmount } = renderHook(() => useOtaUpdate());
    await vi.runAllTimersAsync();
    expect(mocks.toastInfo).not.toHaveBeenCalled();
    unmount();
  });

  it("shows info toast and fetches when update available", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mocks.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    const { unmount } = renderHook(() => useOtaUpdate());
    await vi.runAllTimersAsync();
    expect(mocks.toastInfo).toHaveBeenCalledWith("Update available", {
      description: "Downloading…",
    });
    expect(mocks.fetchUpdateAsync).toHaveBeenCalledOnce();
    unmount();
  });

  it("shows success toast and reloads after 2s when fetched update is new", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mocks.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    mocks.reloadAsync.mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useOtaUpdate());
    // Flush microtask queue: one tick per awaited promise in the IIFE
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Update ready", {
      description: "Restarting to apply.",
      duration: 2000,
    });
    expect(mocks.reloadAsync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.reloadAsync).toHaveBeenCalledOnce();
    unmount();
  });

  it("does not reload when fetched update is not new", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mocks.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    const { unmount } = renderHook(() => useOtaUpdate());
    await vi.runAllTimersAsync();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.reloadAsync).not.toHaveBeenCalled();
    unmount();
  });

  it("cancels reload timer on unmount", async () => {
    mocks.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mocks.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    const { unmount } = renderHook(() => useOtaUpdate());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    unmount();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.reloadAsync).not.toHaveBeenCalled();
  });

  it("logs warning on error without throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.checkForUpdateAsync.mockRejectedValue(new Error("network error"));
    const { unmount } = renderHook(() => useOtaUpdate());
    await vi.runAllTimersAsync();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("update check failed"));
    warnSpy.mockRestore();
    unmount();
  });
});
