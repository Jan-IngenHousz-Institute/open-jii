import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMeasurementLocation } from "~/shared/location/measurement-location";

const mockGetForegroundPermissionsAsync = vi.fn();
const mockGetLastKnownPositionAsync = vi.fn();
const mockGetCurrentPositionAsync = vi.fn();

vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockGetLastKnownPositionAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  Accuracy: { Balanced: 3 },
}));

vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

const COORDS = { coords: { latitude: 52.0907, longitude: 5.1214 } };

beforeEach(() => {
  vi.restoreAllMocks();
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  mockGetLastKnownPositionAsync.mockResolvedValue(null);
  mockGetCurrentPositionAsync.mockResolvedValue(COORDS);
});

describe("getMeasurementLocation", () => {
  it("returns null without prompting when permission is not granted", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });

    expect(await getMeasurementLocation()).toBeNull();
    expect(mockGetLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("prefers a recent last-known fix over a fresh one", async () => {
    mockGetLastKnownPositionAsync.mockResolvedValue(COORDS);

    expect(await getMeasurementLocation()).toEqual({ latitude: 52.0907, longitude: 5.1214 });
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("falls back to a fresh fix when no recent last-known position exists", async () => {
    expect(await getMeasurementLocation()).toEqual({ latitude: 52.0907, longitude: 5.1214 });
    expect(mockGetCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("returns null when the fresh fix does not arrive before the timeout", async () => {
    vi.useFakeTimers();
    mockGetCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));

    const result = getMeasurementLocation();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await result).toBeNull();
    vi.useRealTimers();
  });

  it("returns null instead of throwing on location errors", async () => {
    mockGetLastKnownPositionAsync.mockRejectedValue(new Error("gps unavailable"));

    expect(await getMeasurementLocation()).toBeNull();
  });
});
