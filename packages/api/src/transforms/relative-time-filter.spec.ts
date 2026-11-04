import { describe, expect, it } from "vitest";

import type { ExperimentDataFilter } from "../domains/experiment/data/experiment-data.schema";
import { zExperimentDataFilterValue } from "../domains/experiment/data/experiment-data.schema";
import {
  hasRelativeTimeFilters,
  isRelativeTimeWindow,
  relativeTimeFilterIdentities,
  relativeTimeFilterIdentity,
  resolveRelativeTimeFilters,
  resolveRelativeTimeWindow,
} from "./relative-time-filter";

describe("relative time filters", () => {
  it("distinguishes rolling windows from absent, scalar and fixed-range values", () => {
    for (const value of [undefined, "2026-06-08", 0, false, ["2026-06-01", "2026-06-08"]]) {
      expect(isRelativeTimeWindow(value)).toBe(false);
    }
    expect(isRelativeTimeWindow({ last: 24, unit: "hours" })).toBe(true);
    expect(isRelativeTimeWindow({ last: 7, unit: "days" })).toBe(true);
  });

  it("finds rolling filters in a mixed read without treating saved fixed ranges as relative", () => {
    const fixed: ExperimentDataFilter[] = [
      { column: "timestamp", operator: "between", value: ["2026-06-01", "2026-06-08"] },
      { column: "site", operator: "equals", value: "Amsterdam" },
    ];
    expect(hasRelativeTimeFilters(undefined)).toBe(false);
    expect(hasRelativeTimeFilters([])).toBe(false);
    expect(hasRelativeTimeFilters(fixed)).toBe(false);
    expect(
      hasRelativeTimeFilters([
        ...fixed,
        { column: "recorded_at", operator: "between", value: { last: 7, unit: "days" } },
      ]),
    ).toBe(true);
  });

  it("keeps a rolling filter identity stable across serialization and distinct by column and window", () => {
    const first = relativeTimeFilterIdentity("timestamp", { last: 24, unit: "hours" });
    const reordered = zExperimentDataFilterValue.parse({ unit: "hours", last: 24 });
    if (!isRelativeTimeWindow(reordered)) throw new Error("Expected a rolling window");
    expect(relativeTimeFilterIdentity("timestamp", reordered)).toBe(first);
    expect(relativeTimeFilterIdentity("recorded_at", reordered)).not.toBe(first);
    expect(relativeTimeFilterIdentity("timestamp", { last: 1, unit: "hours" })).not.toBe(first);
    expect(relativeTimeFilterIdentity("timestamp", { last: 7, unit: "days" })).not.toBe(first);
  });

  it("extracts only the rolling identities used to match read responses to filter labels", () => {
    expect(relativeTimeFilterIdentities(undefined)).toEqual([]);
    expect(relativeTimeFilterIdentities([])).toEqual([]);
    expect(
      relativeTimeFilterIdentities([
        { column: "timestamp", operator: "between", value: ["2026-06-01", "2026-06-08"] },
        { column: "site", operator: "equals", value: "Amsterdam" },
        { column: "recorded_at", operator: "between", value: { last: 24, unit: "hours" } },
        { column: "uploaded_at", operator: "between", value: { last: 7, unit: "days" } },
      ]),
    ).toEqual(['["recorded_at",24,"hours"]', '["uploaded_at",7,"days"]']);
  });

  it.each(["2026-03-29T01:15:59.999Z", "2026-10-25T01:15:59.999Z"])(
    "resolves elapsed days across DST at %s with a UTC minute anchor",
    (at) => {
      const bounds = resolveRelativeTimeWindow({ last: 7, unit: "days" }, Date.parse(at));
      expect(Date.parse(bounds[1]) - Date.parse(bounds[0])).toBe(168 * 3600000);
      expect(bounds[1]).toBe(at.replace("59.999Z", "00.000Z"));
      expect(Date.parse(at) - Date.parse(bounds[1])).toBe(59999);
    },
  );

  it("resolves all windows at one instant and preserves old absolute bounds", () => {
    const absolute = {
      column: "timestamp",
      operator: "between" as const,
      value: ["2025-01-01T00:00:00.000Z", "2025-01-02T00:00:00.000Z"],
    };
    const filters = [
      absolute,
      {
        column: "recorded_at",
        operator: "between" as const,
        value: { last: 24 as const, unit: "hours" as const },
      },
    ];
    const first = resolveRelativeTimeFilters(filters, Date.parse("2026-11-01T12:30:59.000Z"));
    const later = resolveRelativeTimeFilters(filters, Date.parse("2026-11-02T12:31:00.000Z"));
    expect(first[0]).toEqual(absolute);
    expect(later[0]).toEqual(absolute);
    expect(first[1]?.value).toEqual(["2026-10-31T12:30:00.000Z", "2026-11-01T12:30:00.000Z"]);
    expect(later[1]?.value).toEqual(["2026-11-01T12:31:00.000Z", "2026-11-02T12:31:00.000Z"]);
    expect(filters[1]?.value).toEqual({ last: 24, unit: "hours" });
  });
});
