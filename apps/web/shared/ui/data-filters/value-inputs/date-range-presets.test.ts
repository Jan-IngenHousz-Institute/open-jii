import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DATE_RANGE_PRESETS, computeDateRangePreset } from "./date-range-presets";
import type { DateRangePresetId } from "./date-range-presets";

describe("DATE_RANGE_PRESETS", () => {
  it("exposes every preset id with an i18n key under dataFilters.*", () => {
    expect(DATE_RANGE_PRESETS.length).toBeGreaterThan(0);
    for (const preset of DATE_RANGE_PRESETS) {
      expect(preset.labelKey).toMatch(/^dataFilters\./);
    }
  });

  it("contains no duplicate ids", () => {
    const ids = DATE_RANGE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("computeDateRangePreset", () => {
  const NOW = new Date("2025-05-15T10:30:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("last1h ends at now and starts an hour earlier", () => {
    const [start, end] = computeDateRangePreset("last1h");
    expect(end.getTime()).toBe(NOW.getTime());
    expect(NOW.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it("last24h starts 24 hours before now", () => {
    const [start, end] = computeDateRangePreset("last24h");
    expect(end.getTime()).toBe(NOW.getTime());
    expect(NOW.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("last7d starts seven days before now", () => {
    const [start] = computeDateRangePreset("last7d");
    expect(NOW.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("thisMonth starts at the first of the current month", () => {
    const [start, end] = computeDateRangePreset("thisMonth");
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(NOW.getMonth());
    expect(end.getTime()).toBe(NOW.getTime());
  });

  it("lastMonth covers the previous calendar month", () => {
    const [start, end] = computeDateRangePreset("lastMonth");
    expect(start.getDate()).toBe(1);
    // Anchored to the previous month, regardless of the local timezone offset.
    expect(end.getTime()).toBeLessThan(NOW.getTime());
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it("thisYear and yearToDate both span from Jan 1 to now", () => {
    const [startThis, endThis] = computeDateRangePreset("thisYear");
    const [startYtd, endYtd] = computeDateRangePreset("yearToDate");
    expect(startThis.getMonth()).toBe(0);
    expect(startThis.getDate()).toBe(1);
    expect(endThis.getTime()).toBe(NOW.getTime());
    expect(startYtd.getTime()).toBe(startThis.getTime());
    expect(endYtd.getTime()).toBe(endThis.getTime());
  });

  it("returns a [Date, Date] tuple for every declared preset id", () => {
    for (const preset of DATE_RANGE_PRESETS) {
      const result = computeDateRangePreset(preset.id satisfies DateRangePresetId);
      expect(result[0]).toBeInstanceOf(Date);
      expect(result[1]).toBeInstanceOf(Date);
    }
  });
});
