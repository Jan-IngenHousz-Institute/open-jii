import { describe, it, expect, afterEach, vi } from "vitest";
import { getSyncedUtcTimestampWithTimezone, type WorldTimeApiResponse } from "~/utils/time-sync";

const MOCK_RESPONSE: WorldTimeApiResponse = {
  abbreviation: "CDT",
  client_ip: "8.8.8.8",
  datetime: "2026-03-08T15:00:41.455609-05:00",
  day_of_week: 0,
  day_of_year: 67,
  dst: true,
  dst_from: null,
  dst_offset: 3600,
  dst_until: null,
  raw_offset: -21600,
  timezone: "America/Chicago",
  unixtime: 1773000041,
  utc_datetime: "2026-03-08T20:00:41.455672Z",
  utc_offset: "-05:00",
  week_number: 10,
};

function mockFetchSuccess(data: WorldTimeApiResponse = MOCK_RESPONSE) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchFailure(status: number) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: false,
    status,
  } as Response);
}

describe("getSyncedUtcTimestampWithTimezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return unixtime converted to milliseconds", async () => {
    mockFetchSuccess();

    const result = await getSyncedUtcTimestampWithTimezone();

    expect(result.utcTimestamp).toBe(MOCK_RESPONSE.unixtime * 1000);
  });

  it("should return the timezone from the API response", async () => {
    mockFetchSuccess();

    const result = await getSyncedUtcTimestampWithTimezone();

    expect(result.timezone).toBe("America/Chicago");
  });

  it("should call the worldtimeapi.org IP endpoint", async () => {
    mockFetchSuccess();

    await getSyncedUtcTimestampWithTimezone();

    expect(globalThis.fetch).toHaveBeenCalledWith("https://worldtimeapi.org/api/ip");
  });

  it("should fetch fresh time on every call", async () => {
    mockFetchSuccess();
    mockFetchSuccess({ ...MOCK_RESPONSE, unixtime: 1773000100 });

    const first = await getSyncedUtcTimestampWithTimezone();
    const second = await getSyncedUtcTimestampWithTimezone();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(first.utcTimestamp).toBe(1773000041 * 1000);
    expect(second.utcTimestamp).toBe(1773000100 * 1000);
  });

  it("should throw when the API returns a non-ok response", async () => {
    mockFetchFailure(503);

    await expect(getSyncedUtcTimestampWithTimezone()).rejects.toThrow(
      "Time API request failed with status 503",
    );
  });

  it("should propagate network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network request failed"));

    await expect(getSyncedUtcTimestampWithTimezone()).rejects.toThrow("Network request failed");
  });
});
