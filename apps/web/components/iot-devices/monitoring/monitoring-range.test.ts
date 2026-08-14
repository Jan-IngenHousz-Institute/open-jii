import { describe, expect, it } from "vitest";

import { resolveMonitoringRange } from "./monitoring-range";

const NOW = new Date("2026-08-13T10:30:00.000Z").getTime();

describe("resolveMonitoringRange", () => {
  it("resolves 24h to an hourly-bucketed day ending now", () => {
    const range = resolveMonitoringRange("24h", NOW);

    expect(range.bucket).toBe("hour");
    expect(range.to).toBe("2026-08-13T10:30:00.000Z");
    expect(range.from).toBe("2026-08-12T10:30:00.000Z");
  });

  it("resolves 7d and 30d to daily buckets over the full span", () => {
    const week = resolveMonitoringRange("7d", NOW);
    const month = resolveMonitoringRange("30d", NOW);

    expect(week.bucket).toBe("day");
    expect(week.from).toBe("2026-08-06T10:30:00.000Z");
    expect(month.bucket).toBe("day");
    expect(month.from).toBe("2026-07-14T10:30:00.000Z");
  });
});
