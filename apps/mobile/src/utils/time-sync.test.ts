import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockAsyncStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockAsyncStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockAsyncStorage[key] = value;
      return Promise.resolve();
    }),
  },
}));

vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
  getCurrentPositionAsync: vi.fn(() =>
    Promise.resolve({ coords: { latitude: 41.8781, longitude: -87.6298 } }),
  ),
  Accuracy: { Low: 1 },
}));

vi.mock("@photostructure/tz-lookup", () => ({
  default: vi.fn(() => "America/Chicago"),
}));

vi.mock("sonner-native", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

let mockServerUtcMs = Date.now();
let getTimeCallCount = 0;
vi.mock("~/api/client", () => ({
  getApiClient: () => ({
    health: {
      getTime: () => {
        getTimeCallCount++;
        return Promise.resolve({ status: 200, body: { utcTimestampMs: mockServerUtcMs, utcTimestampSec: Math.floor(mockServerUtcMs / 1000) } });
      },
    },
  }),
}));

// Mock AppState from react-native
let capturedAppStateHandler: ((state: string) => void) | null = null;
const mockRemove = vi.fn();

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn((_event: string, handler: (state: string) => void) => {
      capturedAppStateHandler = handler;
      return { remove: mockRemove };
    }),
  },
}));

// --- Helpers ---

const SYNC_DEBOUNCE_MS = 5_000;

/** Advance past the debounce window so the next maybeExecute fires on the leading edge again. */
async function advancePastDebounce() {
  await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS + 50);
}

// --- Tests ---

describe("time-sync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    capturedAppStateHandler = null;
    mockRemove.mockClear();
    mockServerUtcMs = Date.now();
    getTimeCallCount = 0;

    // Clean up any leftover state from previous tests
    for (const key of Object.keys(mockAsyncStorage)) {
      delete mockAsyncStorage[key];
    }
  });

  afterEach(async () => {
    const { stopTimeSync } = await import("./time-sync");
    stopTimeSync();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("should register an AppState listener on start", async () => {
    const { startTimeSync } = await import("./time-sync");
    const { AppState } = await import("react-native");

    startTimeSync();

    expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should trigger a sync when app comes to foreground", async () => {
    const { startTimeSync, getTimeSyncState } = await import("./time-sync");

    // Server is 5 seconds ahead of device
    mockServerUtcMs = Date.now() + 5000;

    startTimeSync();
    // Let the initial sync settle
    await vi.advanceTimersByTimeAsync(50);

    const stateAfterInit = getTimeSyncState();
    expect(stateAfterInit.isSynced).toBe(true);
    const initialOffset = stateAfterInit.offsetMs;

    // Advance past debounce window so the foreground event can fire
    await advancePastDebounce();

    // Now simulate the server drifting further
    mockServerUtcMs = Date.now() + 12000;

    // Simulate app returning to foreground
    expect(capturedAppStateHandler).not.toBeNull();
    capturedAppStateHandler!("active");
    await vi.advanceTimersByTimeAsync(50);

    const stateAfterForeground = getTimeSyncState();
    expect(stateAfterForeground.isSynced).toBe(true);
    expect(stateAfterForeground.offsetMs).not.toBe(initialOffset);
  });

  it("should NOT trigger a sync for non-active states (background, inactive)", async () => {
    const { startTimeSync, getTimeSyncState } = await import("./time-sync");

    mockServerUtcMs = Date.now() + 5000;
    startTimeSync();
    await vi.advanceTimersByTimeAsync(50);

    const offsetAfterInit = getTimeSyncState().offsetMs;

    // Change server time so we can detect if a sync happened
    mockServerUtcMs = Date.now() + 99000;

    capturedAppStateHandler!("background");
    await vi.advanceTimersByTimeAsync(50);
    expect(getTimeSyncState().offsetMs).toBe(offsetAfterInit);

    capturedAppStateHandler!("inactive");
    await vi.advanceTimersByTimeAsync(50);
    expect(getTimeSyncState().offsetMs).toBe(offsetAfterInit);
  });

  it("should remove the AppState listener on stop", async () => {
    const { startTimeSync, stopTimeSync } = await import("./time-sync");

    startTimeSync();
    await vi.advanceTimersByTimeAsync(50);

    stopTimeSync();

    expect(mockRemove).toHaveBeenCalled();
  });

  it("should include timezone from GPS in synced state", async () => {
    const { startTimeSync, getTimeSyncState } = await import("./time-sync");

    startTimeSync();
    await vi.advanceTimersByTimeAsync(50);

    expect(getTimeSyncState().timezone).toBe("America/Chicago");
  });

  it("should correct for device clock drift on foreground sync", async () => {
    const { startTimeSync, getSyncedUtcNow } = await import("./time-sync");

    // Server and device are in sync
    const realNow = Date.now();
    mockServerUtcMs = realNow;

    startTimeSync();
    await vi.advanceTimersByTimeAsync(50);

    // Synced UTC should be close to real time
    const syncedBefore = getSyncedUtcNow();
    expect(Math.abs(syncedBefore - realNow)).toBeLessThan(1000);

    // Advance past debounce window so the foreground event can fire
    await advancePastDebounce();

    // Simulate user changing device clock forward by 1 hour
    const oneHour = 3600 * 1000;
    vi.setSystemTime(new Date(realNow + oneHour));

    // Server time hasn't actually changed much
    mockServerUtcMs = realNow + 100;

    // App comes back to foreground → re-sync
    capturedAppStateHandler!("active");
    await vi.advanceTimersByTimeAsync(50);

    // After re-sync, getSyncedUtcNow should reflect the server's reality,
    // not the user's tampered device clock
    const syncedAfter = getSyncedUtcNow();
    expect(Math.abs(syncedAfter - (realNow + 100))).toBeLessThan(1000);
  });

  it("should debounce rapid foreground events within the 5s window", async () => {
    const { startTimeSync, getTimeSyncState } = await import("./time-sync");

    mockServerUtcMs = Date.now() + 5000;
    startTimeSync();
    await vi.advanceTimersByTimeAsync(50);

    // Advance past debounce window so the first foreground burst can fire
    await advancePastDebounce();

    const callsBefore = getTimeCallCount;

    // Fire 10 rapid foreground events
    for (let i = 0; i < 10; i++) {
      capturedAppStateHandler!("active");
    }
    await vi.advanceTimersByTimeAsync(50);

    // Only 1 sync should have gone through (leading edge), the rest debounced
    expect(getTimeCallCount - callsBefore).toBe(1);

    const timestampAfterFirstBurst = getTimeSyncState().lastSyncedAt;

    // Fire more events immediately — still within the 5s window
    for (let i = 0; i < 5; i++) {
      capturedAppStateHandler!("active");
    }
    await vi.advanceTimersByTimeAsync(50);

    // No new sync should have fired
    expect(getTimeSyncState().lastSyncedAt).toBe(timestampAfterFirstBurst);

    // Advance past the debounce window
    await advancePastDebounce();

    const callsBeforeSecondBurst = getTimeCallCount;

    // Now another foreground event should trigger a new sync
    mockServerUtcMs = Date.now() + 9000;
    capturedAppStateHandler!("active");
    await vi.advanceTimersByTimeAsync(50);

    expect(getTimeCallCount - callsBeforeSecondBurst).toBe(1);
    expect(getTimeSyncState().lastSyncedAt).toBeGreaterThan(timestampAfterFirstBurst);
  });

  describe("missed pings and threshold warnings", () => {
    it("should increment missedPings on each failed sync", async () => {
      const { startTimeSync, getTimeSyncState, stopTimeSync } = await import("./time-sync");

      // Start with a successful sync so isSynced = true
      mockServerUtcMs = Date.now();
      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);
      expect(getTimeSyncState().missedPings).toBe(0);

      // Now make the server fail
      const clientModule = await import("~/api/client");
      const spy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      // Advance past debounce, then trigger interval sync
      await advancePastDebounce();
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      await vi.advanceTimersByTimeAsync(50);

      expect(getTimeSyncState().missedPings).toBe(1);
      expect(getTimeSyncState().isSynced).toBe(true); // stays true from initial sync

      spy.mockRestore();
    });

    it("should show toast.warning when missedPings reaches threshold (3)", async () => {
      const { startTimeSync, getTimeSyncState, stopTimeSync } = await import("./time-sync");
      const { toast } = await import("sonner-native");

      // Successful initial sync
      mockServerUtcMs = Date.now();
      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      // Make server fail
      const clientModule = await import("~/api/client");
      const spy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      (toast.warning as ReturnType<typeof vi.fn>).mockClear();

      // Trigger 3 failed syncs via interval (each needs debounce window to pass)
      for (let i = 0; i < 3; i++) {
        await advancePastDebounce();
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
        await vi.advanceTimersByTimeAsync(50);
      }

      expect(getTimeSyncState().missedPings).toBe(3);
      expect(toast.warning).toHaveBeenCalledWith(
        "Time sync lost. Please check your phone's date and time settings.",
      );

      spy.mockRestore();
    });

    it("should show toast.warning on initial sync failure", async () => {
      // Make server fail from the start
      const clientModule = await import("~/api/client");
      const spy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      const { startTimeSync } = await import("./time-sync");
      const { toast } = await import("sonner-native");
      (toast.warning as ReturnType<typeof vi.fn>).mockClear();

      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.warning).toHaveBeenCalledWith("Unable to synchronize time.");

      spy.mockRestore();
    });

    it("should reset missedPings to 0 after a successful sync", async () => {
      const { startTimeSync, getTimeSyncState } = await import("./time-sync");

      mockServerUtcMs = Date.now();
      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      // Fail once
      const clientModule = await import("~/api/client");
      const spy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      await advancePastDebounce();
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      await vi.advanceTimersByTimeAsync(50);
      expect(getTimeSyncState().missedPings).toBe(1);

      // Restore working server
      spy.mockRestore();

      await advancePastDebounce();
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      await vi.advanceTimersByTimeAsync(50);
      expect(getTimeSyncState().missedPings).toBe(0);
    });
  });

  describe("restoreState from AsyncStorage", () => {
    it("should restore persisted state on startTimeSync", async () => {
      const persisted: import("./time-sync").TimeSyncState = {
        offsetMs: 4200,
        timezone: "Europe/Amsterdam",
        isSynced: true,
        missedPings: 5,
        lastSyncedAt: Date.now() - 60_000,
      };
      mockAsyncStorage["TIME_SYNC_STATE"] = JSON.stringify(persisted);

      const { startTimeSync, getTimeSyncState } = await import("./time-sync");

      startTimeSync();
      // Let restoreState + performSync settle
      await vi.advanceTimersByTimeAsync(50);

      const s = getTimeSyncState();
      // After restore + successful sync, isSynced should be true and missedPings reset
      expect(s.isSynced).toBe(true);
      expect(s.missedPings).toBe(0);
      // timezone comes from the fresh GPS resolve, not the persisted value
      expect(s.timezone).toBe("America/Chicago");
    });

    it("should reset missedPings to 0 when restoring", async () => {
      // Persisted state has missedPings = 7
      const persisted: import("./time-sync").TimeSyncState = {
        offsetMs: 100,
        timezone: "Asia/Tokyo",
        isSynced: true,
        missedPings: 7,
        lastSyncedAt: Date.now() - 120_000,
      };
      mockAsyncStorage["TIME_SYNC_STATE"] = JSON.stringify(persisted);

      // Make the initial sync fail so we can observe the restored state before sync overwrites it
      const clientModule = await import("~/api/client");
      const spy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      const { startTimeSync, getTimeSyncState } = await import("./time-sync");

      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      const s = getTimeSyncState();
      // restoreState resets missedPings to 0, then the failed sync bumps it to 1
      expect(s.missedPings).toBe(1);
      // isSynced should still be true from the restored state
      expect(s.isSynced).toBe(true);

      spy.mockRestore();
    });

    it("should handle missing AsyncStorage data gracefully", async () => {
      // No persisted state — mockAsyncStorage is empty
      const { startTimeSync, getTimeSyncState } = await import("./time-sync");

      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      // Should still sync successfully from scratch
      expect(getTimeSyncState().isSynced).toBe(true);
    });
  });

  describe("ensureSynced", () => {
    it("should resolve immediately if already synced", async () => {
      const { startTimeSync, ensureSynced } = await import("./time-sync");

      mockServerUtcMs = Date.now();
      startTimeSync();
      await vi.advanceTimersByTimeAsync(50);

      // Already synced — should resolve without waiting
      await ensureSynced();
    });

    it("should wait for sync to complete when not yet synced", async () => {
      const { ensureSynced, getTimeSyncState } = await import("./time-sync");

      mockServerUtcMs = Date.now() + 3000;

      let resolved = false;
      const promise = ensureSynced().then(() => {
        resolved = true;
      });

      // The sync is in-flight but hasn't settled yet
      expect(resolved).toBe(false);

      // Let the async sync (performSync) settle
      await vi.advanceTimersByTimeAsync(50);

      await promise;
      expect(resolved).toBe(true);
      expect(getTimeSyncState().isSynced).toBe(true);
    });

    it("should reject after timeout if sync never succeeds", async () => {
      // Make fetchServerTime always fail
      const clientModule = await import("~/api/client");
      const getApiClientSpy = vi.spyOn(clientModule, "getApiClient").mockReturnValue({
        health: {
          getTime: () => Promise.resolve({ status: 500, body: {} }),
        },
      } as any);

      const { ensureSynced } = await import("./time-sync");
      const { toast } = await import("sonner-native");

      // Attach the rejection handler before advancing timers so the
      // rejection is never seen as "unhandled" by the runtime.
      const promise = ensureSynced();
      const resultPromise = promise.then(
        () => {
          throw new Error("Expected ensureSynced to reject");
        },
        (err: Error) => err,
      );

      // Advance past the 10s timeout
      await vi.advanceTimersByTimeAsync(10_000 + 50);

      const error = await resultPromise;
      expect(error.message).toMatch("Timed out waiting for initial sync");
      expect(toast.error).toHaveBeenCalledWith(
        "Time sync unavailable. Please check your connection and try again.",
      );

      getApiClientSpy.mockRestore();
    });

    it("should resolve multiple waiters when sync completes", async () => {
      const { ensureSynced, getTimeSyncState } = await import("./time-sync");

      mockServerUtcMs = Date.now() + 1000;

      let resolvedCount = 0;
      const p1 = ensureSynced().then(() => resolvedCount++);
      const p2 = ensureSynced().then(() => resolvedCount++);
      const p3 = ensureSynced().then(() => resolvedCount++);

      // Let the sync settle
      await vi.advanceTimersByTimeAsync(50);

      await Promise.all([p1, p2, p3]);
      expect(resolvedCount).toBe(3);
      expect(getTimeSyncState().isSynced).toBe(true);
    });
  });
});
