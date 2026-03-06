import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted" },
  Accuracy: { Lowest: 1 },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

vi.mock("@photostructure/tz-lookup", () => ({
  default: vi.fn(() => "Europe/Amsterdam"),
}));

import * as Location from "expo-location";
import { getSyncedUtcTimestampWithTimezone, clearTimeSyncCache } from "~/utils/time-sync";

const GPS_TIME = 1709548200000;
const TIMEZONE = "Europe/Amsterdam";

function mockLocation(timestamp = GPS_TIME, lat = 52.37, lon = 4.9) {
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
    status: Location.PermissionStatus.GRANTED,
    granted: true,
    expires: "never",
    canAskAgain: true,
  });
  vi.mocked(Location.getCurrentPositionAsync).mockResolvedValueOnce({
    timestamp,
    coords: { latitude: lat, longitude: lon, altitude: null, accuracy: null, altitudeAccuracy: null, heading: null, speed: null },
  } as any);
}

describe("time-sync", () => {
  beforeEach(() => {
    clearTimeSyncCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return GPS timestamp and timezone", async () => {
    mockLocation();

    const result = await getSyncedUtcTimestampWithTimezone();

    expect(result.utcTimestamp).toBe(GPS_TIME);
    expect(result.timezone).toBe(TIMEZONE);
  });

  it("should cache result and not call GPS again within 30 seconds", async () => {
    mockLocation();

    await getSyncedUtcTimestampWithTimezone();
    await getSyncedUtcTimestampWithTimezone();

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("should estimate time from cache using elapsed local time", async () => {
    mockLocation();

    const first = await getSyncedUtcTimestampWithTimezone();

    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = await getSyncedUtcTimestampWithTimezone();

    expect(second.utcTimestamp).toBeGreaterThan(first.utcTimestamp);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("should refetch after cache is cleared", async () => {
    mockLocation();
    await getSyncedUtcTimestampWithTimezone();

    clearTimeSyncCache();

    mockLocation(GPS_TIME + 30_000);
    const result = await getSyncedUtcTimestampWithTimezone();

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    expect(result.utcTimestamp).toBe(GPS_TIME + 30_000);
  });

  it("should fallback to local time and device timezone when location permission is denied", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      status: "denied" as any,
      granted: false,
      expires: "never",
      canAskAgain: false,
    });

    const before = Date.now();
    const result = await getSyncedUtcTimestampWithTimezone();
    const after = Date.now();

    expect(result.utcTimestamp).toBeGreaterThanOrEqual(before);
    expect(result.utcTimestamp).toBeLessThanOrEqual(after);
    expect(typeof result.timezone).toBe("string");
    expect(result.timezone.length).toBeGreaterThan(0);
  });

  it("should fallback when GPS throws", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockRejectedValueOnce(
      new Error("GPS unavailable"),
    );

    const before = Date.now();
    const result = await getSyncedUtcTimestampWithTimezone();

    expect(result.utcTimestamp).toBeGreaterThanOrEqual(before);
    expect(typeof result.timezone).toBe("string");
  });
});
