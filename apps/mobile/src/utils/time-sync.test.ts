import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock environment store before any imports
vi.mock("~/stores/environment-store", () => ({
  getEnvVar: vi.fn(() => "https://api.test.example.com"),
}));

import { getSyncedTime, clearTimeSyncCache } from "~/utils/time-sync";

describe("time-sync", () => {
  beforeEach(() => {
    clearTimeSyncCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return server time", async () => {
    const serverTime = 1709548200000;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unixTimestamp: serverTime }),
    });

    const syncedTime = await getSyncedTime();
    const diff = Math.abs(syncedTime.getTime() - serverTime);

    // Should match server time
    expect(diff).toBeLessThan(10);
  });

  it("should cache server time for 30 seconds", async () => {
    const serverTime = 1709548200000;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unixTimestamp: serverTime }),
    });

    await getSyncedTime();
    await getSyncedTime();

    // Should only call fetch once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should estimate server time from cache", async () => {
    const serverTime = 1709548200000;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unixTimestamp: serverTime }),
    });

    const firstCall = await getSyncedTime();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    const secondCall = await getSyncedTime();

    // Second call should be slightly ahead of first call
    expect(secondCall.getTime()).toBeGreaterThanOrEqual(firstCall.getTime());
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should fallback to local time when server is unreachable", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const localTime = Date.now();
    const syncedTime = await getSyncedTime();
    const diff = Math.abs(syncedTime.getTime() - localTime);

    // Should fallback to local time
    expect(diff).toBeLessThan(100);
  });

  it("should refetch after cache expires", async () => {
    const serverTime1 = 1709548200000;
    const serverTime2 = 1709548230000;

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unixTimestamp: serverTime1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unixTimestamp: serverTime2 }),
      });

    await getSyncedTime();

    // Clear cache to simulate expiration
    clearTimeSyncCache();

    await getSyncedTime();

    // Should call fetch twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
