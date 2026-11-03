import { describe, expect, it } from "vitest";

import type { DayRecord } from "./status-document.js";
import { dayRecordSchema } from "./status-document.js";
import {
  DAY_DEGRADED_MINUTES,
  DAY_MINUTES,
  dayState,
  minuteOf,
  recordMinute,
  recordUnknown,
  totalDegradedMinutes,
  uptimePercent,
} from "./status-history.js";

interface Counts {
  recorded?: number;
  down?: number;
  degraded?: number;
  maintenance?: number;
  unknown?: number;
}

function day(date: string, counts: Counts = {}): DayRecord {
  const record = {
    recordedMinutes: counts.recorded ?? DAY_MINUTES,
    downMinutes: counts.down ?? 0,
    degradedMinutes: counts.degraded ?? 0,
    maintenanceMinutes: counts.maintenance ?? 0,
    unknownMinutes: counts.unknown ?? 0,
  };
  return { date, ...record, state: dayState(record), incidentIds: [] };
}

function minute(iso: string): number {
  return minuteOf(new Date(iso));
}

function datesOf(days: DayRecord[]): string[] {
  return days.map((record) => record.date);
}

describe("dayState", () => {
  it.each([
    ["no minutes recorded", { recorded: 0 }, "none"],
    ["only unknown minutes", { recorded: 10, unknown: 10 }, "none"],
    ["measured and clean", { recorded: 10 }, "operational"],
    ["unknown beside clean minutes", { recorded: 10, unknown: 4 }, "operational"],
    ["one degraded minute", { recorded: 10, degraded: 1 }, "operational"],
    [
      "degraded minutes one short of the day limit",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES - 1 },
      "operational",
    ],
    [
      "degraded minutes at the day limit",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES },
      "degraded",
    ],
    [
      "degraded minutes past the day limit",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES + 1 },
      "degraded",
    ],
    [
      "unknown minutes beside degraded ones below the limit",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES - 1, unknown: 4 },
      "operational",
    ],
    ["a maintenance minute", { recorded: 10, maintenance: 1 }, "maintenance"],
    ["only maintenance and unknown", { recorded: 10, maintenance: 6, unknown: 4 }, "maintenance"],
    [
      "degraded minutes at the day limit over maintenance",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES, maintenance: 5 },
      "degraded",
    ],
    [
      "degraded minutes below the day limit beside maintenance",
      { recorded: 10, degraded: DAY_DEGRADED_MINUTES - 1, maintenance: 5 },
      "maintenance",
    ],
    [
      "a down minute over degraded",
      { recorded: 10, down: 1, degraded: DAY_DEGRADED_MINUTES },
      "outage",
    ],
    [
      "a down minute beside a blip of degraded minutes",
      { recorded: 10, down: 1, degraded: 1 },
      "outage",
    ],
    [
      "a down minute with everything else",
      { recorded: 10, down: 1, maintenance: 1, unknown: 1 },
      "outage",
    ],
  ] satisfies [string, Counts, string][])("reads %s as %s", (_name, counts, expected) => {
    const record = day("2026-11-01", counts);
    expect(record.state).toBe(expected);
  });
});

describe("recordMinute", () => {
  it("starts a day at one recorded minute", () => {
    const days = recordMinute([], minute("2026-11-03T12:00:00Z"), "operational", []);

    expect(days).toEqual([
      {
        date: "2026-11-03",
        state: "operational",
        recordedMinutes: 1,
        downMinutes: 0,
        degradedMinutes: 0,
        maintenanceMinutes: 0,
        unknownMinutes: 0,
        incidentIds: [],
      },
    ]);
  });

  it.each([
    ["outage", "downMinutes", "outage"],
    ["degraded", "degradedMinutes", "operational"],
    ["maintenance", "maintenanceMinutes", "maintenance"],
  ] as const)("counts a %s minute in %s and colours the day %s", (outcome, field, state) => {
    const record = recordMinute([], minute("2026-11-03T12:00:00Z"), outcome, []).at(0);

    expect(record?.[field]).toBe(1);
    expect(record?.state).toBe(state);
  });

  it.each([
    ["one fewer than the day limit", DAY_DEGRADED_MINUTES - 1, "operational"],
    ["the day limit", DAY_DEGRADED_MINUTES, "degraded"],
  ] satisfies [string, number, string][])(
    "counts %s of degraded minutes on a day and colours it %s",
    (_name, degradedMinutes, state) => {
      const start = minute("2026-11-03T12:00:00Z");
      let days = recordMinute([], start, "operational", []);
      for (let offset = 1; offset <= degradedMinutes; offset += 1) {
        days = recordMinute(days, start + offset, "degraded", []);
      }

      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({
        recordedMinutes: degradedMinutes + 1,
        degradedMinutes,
        state,
      });
    },
  );

  it("adds to the same day and keeps the worst state", () => {
    let days = recordMinute([], minute("2026-11-03T12:00:00Z"), "operational", []);
    days = recordMinute(days, minute("2026-11-03T12:01:00Z"), "outage", []);
    days = recordMinute(days, minute("2026-11-03T12:02:00Z"), "operational", []);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ recordedMinutes: 3, downMinutes: 1, state: "outage" });
  });

  it("keeps each incident id once", () => {
    let days = recordMinute([], minute("2026-11-03T12:00:00Z"), "outage", ["a", "b"]);
    days = recordMinute(days, minute("2026-11-03T12:01:00Z"), "outage", ["b", "c"]);

    expect(days[0]?.incidentIds).toEqual(["a", "b", "c"]);
  });

  it("opens a new day after midnight, oldest first", () => {
    let days = recordMinute([], minute("2026-11-03T00:00:00Z"), "operational", []);
    days = recordMinute(days, minute("2026-11-02T23:59:00Z"), "operational", []);

    expect(datesOf(days)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("keeps only the latest ninety days", () => {
    const start = minute("2026-01-01T00:00:00Z");
    let days: DayRecord[] = [];
    for (let offset = 0; offset < 91; offset += 1) {
      days = recordMinute(days, start + offset * DAY_MINUTES, "operational", []);
    }

    expect(days).toHaveLength(90);
    expect(days[0]?.date).toBe("2026-01-02");
    expect(days[89]?.date).toBe("2026-04-01");
  });

  it("produces records the contract accepts", () => {
    const days = recordMinute([], minute("2026-11-03T12:00:00Z"), "degraded", ["incident-1"]);

    expect(days.map((record) => dayRecordSchema.parse(record))).toEqual(days);
  });
});

describe("recordUnknown", () => {
  it("counts unknown minutes as recorded on their day", () => {
    const days = recordUnknown([], minute("2026-11-03T12:01:00Z"), minute("2026-11-03T12:04:00Z"));

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-11-03",
      recordedMinutes: 4,
      unknownMinutes: 4,
      state: "none",
    });
  });

  it("splits a gap across midnight onto each day", () => {
    const days = recordUnknown([], minute("2026-11-02T23:59:00Z"), minute("2026-11-03T00:02:00Z"));

    expect(
      days.map((record) => [record.date, record.unknownMinutes, record.recordedMinutes]),
    ).toEqual([
      ["2026-11-02", 1, 1],
      ["2026-11-03", 3, 3],
    ]);
  });

  it("fills whole days between the ends of a long gap", () => {
    const days = recordUnknown([], minute("2026-11-01T23:00:00Z"), minute("2026-11-04T00:29:00Z"));

    expect(days.map((record) => [record.date, record.unknownMinutes])).toEqual([
      ["2026-11-01", 60],
      ["2026-11-02", 1440],
      ["2026-11-03", 1440],
      ["2026-11-04", 30],
    ]);
  });

  it("adds to a day that already has minutes", () => {
    const before = recordMinute([], minute("2026-11-03T12:00:00Z"), "operational", []);
    const days = recordUnknown(
      before,
      minute("2026-11-03T12:01:00Z"),
      minute("2026-11-03T12:02:00Z"),
    );

    expect(days[0]).toMatchObject({ recordedMinutes: 3, unknownMinutes: 2, state: "operational" });
  });

  it("records nothing for an empty range", () => {
    const at = minute("2026-11-03T12:00:00Z");

    expect(recordUnknown([], at + 1, at)).toEqual([]);
  });

  it("cuts a gap longer than the history to the history", () => {
    const days = recordUnknown([], minute("2026-05-01T00:00:00Z"), minute("2026-11-03T00:00:00Z"));

    expect(days).toHaveLength(90);
    expect(days[89]?.date).toBe("2026-11-03");
    expect(days.every((record) => record.unknownMinutes === record.recordedMinutes)).toBe(true);
    expect(days.slice(0, 89).every((record) => record.recordedMinutes === DAY_MINUTES)).toBe(true);
  });
});

describe("uptimePercent", () => {
  it.each([
    ["no days", [], 100],
    ["a clean day", [day("2026-11-01")], 100],
    ["one down minute in a day", [day("2026-11-01", { down: 1 })], 99.93],
    ["a degraded day, which is not downtime", [day("2026-11-01", { degraded: 1440 })], 100],
    ["half a day unknown", [day("2026-11-01", { unknown: 720 })], 50],
    ["down and unknown together", [day("2026-11-01", { down: 360, unknown: 360 })], 50],
    [
      "maintenance taken out of both sides",
      [day("2026-11-01", { maintenance: 720, down: 72 })],
      90,
    ],
    ["a day of only maintenance", [day("2026-11-01", { recorded: 100, maintenance: 100 })], 100],
    ["a third down", [day("2026-11-01", { recorded: 3, down: 1 })], 66.67],
    [
      "minutes summed over days",
      [day("2026-11-01", { down: 1440 }), day("2026-11-02"), day("2026-11-03"), day("2026-11-04")],
      75,
    ],
    [
      "a day of nothing recorded beside a clean one",
      [day("2026-11-01", { recorded: 0 }), day("2026-11-02")],
      100,
    ],
  ] satisfies [string, DayRecord[], number][])("reads %s as %s", (_name, days, expected) => {
    expect(uptimePercent(days)).toBe(expected);
  });

  it.each([
    ["down", { down: 1 }],
    ["unknown", { unknown: 1 }],
  ] satisfies [string, Counts][])(
    "never shows 100 for one %s minute in ninety days",
    (_name, counts) => {
      const days = Array.from({ length: 90 }, (_, index) =>
        day(
          new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
          index === 0 ? counts : {},
        ),
      );

      expect(uptimePercent(days)).toBe(99.99);
    },
  );
});

describe("totalDegradedMinutes", () => {
  it("sums the degraded minutes of every day", () => {
    const days = [
      day("2026-11-01", { degraded: 5 }),
      day("2026-11-02"),
      day("2026-11-03", { degraded: 7 }),
    ];

    expect(totalDegradedMinutes(days)).toBe(12);
  });
});
