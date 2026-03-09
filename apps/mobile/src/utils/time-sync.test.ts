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
  requestForegroundPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted" }),
  ),
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
vi.mock("~/api/client", () => ({
  getApiClient: () => ({
    health: {
      getTime: () =>
        Promise.resolve({ status: 200, body: { utcTimestamp: mockServerUtcMs } }),
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

// --- Tests ---

describe("time-sync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    capturedAppStateHandler = null;
    mockRemove.mockClear();
    mockServerUtcMs = Date.now();

    // Clean up any leftover state from previous tests
    for (const key of Object.keys(mockAsyncStorage)) {
      delete mockAsyncStorage[key];
    }
  });

  afterEach(async () => {
    // Dynamic import so mocks are in place
    const { stopTimeSync } = await import("./time-sync");
    stopTimeSync();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("should register an AppState listener on start", async () => {
    const { startTimeSync } = await import("./time-sync");
    const { AppState } = await import("react-native");

    startTimeSync();

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
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

    // Now simulate the server drifting further (or device clock changing)
    mockServerUtcMs = Date.now() + 12000;

    // Simulate app returning to foreground
    expect(capturedAppStateHandler).not.toBeNull();
    capturedAppStateHandler!("active");
    await vi.advanceTimersByTimeAsync(50);

    const stateAfterForeground = getTimeSyncState();
    // Offset should have been updated (not the same as initial)
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
    // Should be close to the server's actual time (~realNow + 100), not realNow + 1hr
    expect(Math.abs(syncedAfter - (realNow + 100))).toBeLessThan(1000);
  });
});
