import { describe, expect, it } from "vitest";

import {
  isRangeWithinLimit,
  rangeFromCalendarSelection,
  resolveMonitoringPreset,
  toMonitoringRange,
} from "./monitoring-range";

const NOW = new Date("2026-08-15T10:30:00.000Z").getTime();

describe("monitoring range", () => {
  it("resolves short presets to an hourly window", () => {
    const day = resolveMonitoringPreset("last24h", NOW);

    expect(day.bucket).toBe("hour");
    expect(day.from).toBe("2026-08-14T10:30:00.000Z");
    expect(day.to).toBe("2026-08-15T10:30:00.000Z");
  });

  it("drops to daily buckets once the window outgrows an hourly axis", () => {
    expect(resolveMonitoringPreset("last7d", NOW).bucket).toBe("day");
    expect(resolveMonitoringPreset("last30d", NOW).bucket).toBe("day");
  });

  it("picks the bucket for an absolute range from its span", () => {
    const short = toMonitoringRange(
      new Date("2026-08-15T00:00:00Z"),
      new Date("2026-08-16T00:00:00Z"),
    );
    const long = toMonitoringRange(
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-15T00:00:00Z"),
    );

    expect(short.bucket).toBe("hour");
    expect(long.bucket).toBe("day");
  });

  it("refuses reversed and over-long windows, which the contract rejects anyway", () => {
    const from = new Date("2026-08-01T00:00:00Z");

    expect(isRangeWithinLimit(from, new Date("2026-08-20T00:00:00Z"))).toBe(true);
    expect(isRangeWithinLimit(from, new Date("2026-09-20T00:00:00Z"))).toBe(false);
    expect(isRangeWithinLimit(new Date("2026-08-20T00:00:00Z"), from)).toBe(false);
  });

  describe("calendar selection", () => {
    it("covers the closing day, which the picker hands back as its midnight", () => {
      const range = rangeFromCalendarSelection({
        from: new Date("2026-08-10T00:00:00"),
        to: new Date("2026-08-12T00:00:00"),
      });

      expect(range).not.toBeNull();
      expect(new Date(range?.to ?? 0).getHours()).toBe(23);
      expect(range?.bucket).toBe("day");
    });

    it("ignores an incomplete selection instead of guessing the other bound", () => {
      expect(rangeFromCalendarSelection(undefined)).toBeNull();
      expect(rangeFromCalendarSelection({ from: new Date("2026-08-10T00:00:00") })).toBeNull();
    });

    it("ignores a window past the ceiling rather than silently truncating it", () => {
      expect(
        rangeFromCalendarSelection({
          from: new Date("2026-06-01T00:00:00"),
          to: new Date("2026-08-12T00:00:00"),
        }),
      ).toBeNull();
    });
  });
});
