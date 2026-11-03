import { describe, expect, it } from "vitest";

import type { DayRecord } from "@repo/monitoring/status-document";

import { padDays } from "../history-days";

const DAY_MS = 86_400_000;

function recorded(date: string): DayRecord {
  return {
    date,
    state: "operational",
    recordedMinutes: 1440,
    downMinutes: 0,
    degradedMinutes: 0,
    maintenanceMinutes: 0,
    unknownMinutes: 0,
    incidentIds: [],
  };
}

function datesOf(days: DayRecord[]) {
  return days.map((day) => day.date);
}

function stepsBetween(dates: string[]) {
  return dates.slice(1).map((date, index) => Date.parse(date) - Date.parse(dates[index] ?? date));
}

describe("padDays", () => {
  it("pads a short history to 90 days, dated back from the first record", () => {
    const padded = padDays([recorded("2026-11-02"), recorded("2026-11-03")], "2026-11-02");

    expect(padded).toHaveLength(90);
    expect(padded[0]?.date).toBe("2026-08-06");
    expect(padded[87]?.date).toBe("2026-11-01");
    expect(padded[88]?.date).toBe("2026-11-02");
    expect(padded[89]?.date).toBe("2026-11-03");
  });

  it("draws the padding as days with no record", () => {
    const padded = padDays([recorded("2026-11-03")], "2026-11-03");

    expect(padded.slice(0, 89).every((day) => day.state === "none")).toBe(true);
    expect(padded.slice(0, 89).every((day) => day.recordedMinutes === 0)).toBe(true);
    expect(padded[89]?.state).toBe("operational");
  });

  it("changes nothing in a full history", () => {
    const days = Array.from({ length: 90 }, (_, index) =>
      recorded(new Date(Date.UTC(2026, 7, 6) + index * DAY_MS).toISOString().slice(0, 10)),
    );

    expect(padDays(days, "2026-08-06")).toEqual(days);
  });

  it.each([
    ["the end of daylight saving in the US", "2026-11-02", ["2026-10-31", "2026-11-01"]],
    ["the start of daylight saving in the US", "2026-03-09", ["2026-03-07", "2026-03-08"]],
    ["the start of daylight saving in Europe", "2026-03-30", ["2026-03-28", "2026-03-29"]],
    ["the end of daylight saving in Europe", "2026-10-26", ["2026-10-24", "2026-10-25"]],
  ])("counts whole days across %s", (_name, firstRecord, expected) => {
    const padded = padDays([recorded(firstRecord)], firstRecord);
    const dates = datesOf(padded);

    expect(dates).toEqual(expect.arrayContaining(expected));
    expect(new Set(dates).size).toBe(90);
    expect(stepsBetween(dates).every((step) => step === DAY_MS)).toBe(true);
  });
});
