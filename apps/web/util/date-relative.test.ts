import { describe, expect, it } from "vitest";

import { daysUntil, formatRelativeTime, formatShortDate } from "./date";

const NOW = new Date("2026-07-19T12:00:00.000Z").getTime();

describe("formatRelativeTime", () => {
  it("formats minutes, hours, and days in the past", () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000), "en-US", NOW)).toBe("5 minutes ago");
    expect(formatRelativeTime(new Date(NOW - 2 * 3_600_000), "en-US", NOW)).toBe("2 hours ago");
    expect(formatRelativeTime(new Date(NOW - 4 * 86_400_000), "en-US", NOW)).toBe("4 days ago");
  });

  it("falls back to an absolute date beyond 30 days", () => {
    expect(formatRelativeTime(new Date(NOW - 90 * 86_400_000), "en-US", NOW)).toBe("Apr 20, 2026");
  });

  it("respects the locale", () => {
    expect(formatRelativeTime(new Date(NOW - 2 * 3_600_000), "de-DE", NOW)).toBe("vor 2 Stunden");
  });
});

describe("formatShortDate", () => {
  it("formats an ISO string as a short date", () => {
    expect(formatShortDate("2026-07-01T00:00:00.000Z", "en-US")).toMatch(/Ju[nl] \d{1,2}, 2026/);
  });
});

describe("daysUntil", () => {
  it("counts whole days remaining, rounding up", () => {
    expect(daysUntil(new Date(NOW + 9 * 86_400_000), NOW)).toBe(9);
    expect(daysUntil(new Date(NOW + 0.5 * 86_400_000), NOW)).toBe(1);
    expect(daysUntil(new Date(NOW - 86_400_000), NOW)).toBe(-1);
  });
});
