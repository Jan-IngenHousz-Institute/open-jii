import { afterEach, describe, expect, it, vi } from "vitest";

import type { DayRecord, Incident } from "@repo/monitoring/status-document";

import { problemDays, summarizeDay } from "./day-summary";

function day(date: string, minutes: Partial<DayRecord> = {}): DayRecord {
  return {
    date,
    state: "operational",
    recordedMinutes: 1440,
    downMinutes: 0,
    degradedMinutes: 0,
    maintenanceMinutes: 0,
    unknownMinutes: 0,
    ...minutes,
  };
}

const GENERATED_AT = "2026-11-03T12:00:00.000Z";

const incident: Incident = {
  id: "outage-1",
  kind: "incident",
  title: "Measurements are not reaching the platform",
  impact: "outage",
  components: ["data-intake"],
  startsAt: "2026-10-09T10:00:00.000Z",
  resolvedAt: "2026-10-09T10:25:00.000Z",
  updates: [],
};

function written(overrides: Partial<Incident>): Incident {
  return { ...incident, ...overrides };
}

function listedOn(date: string, incidents: Incident[]) {
  return summarizeDay(day(date), incidents, GENERATED_AT).related.map((entry) => entry.id);
}

describe("problemDays", () => {
  it("lists the days that were not fully operational, newest first", () => {
    const days = [
      day("2026-10-01", { degradedMinutes: 20 }),
      day("2026-10-02"),
      day("2026-10-03", { downMinutes: 42, degradedMinutes: 9 }),
      day("2026-10-04"),
    ];

    expect(problemDays(days, [], GENERATED_AT).map((entry) => entry.day.date)).toEqual([
      "2026-10-03",
      "2026-10-01",
    ]);
  });

  it("keeps a blip too short to colour its bar", () => {
    const listed = problemDays([day("2026-10-01", { degradedMinutes: 4 })], [], GENERATED_AT);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.summary.rows).toEqual([{ kind: "degraded", minutes: 4 }]);
  });

  it("counts maintenance and minutes the checks could not run", () => {
    const listed = problemDays(
      [day("2026-10-01", { maintenanceMinutes: 60 }), day("2026-10-02", { unknownMinutes: 4 })],
      [],
      GENERATED_AT,
    );

    expect(listed.map((entry) => entry.summary.rows[0]?.kind)).toEqual(["unknown", "maintenance"]);
  });

  it("leaves out days with no record and days that were clean", () => {
    const days = [day("2026-10-01", { recordedMinutes: 0 }), day("2026-10-02")];

    expect(problemDays(days, [], GENERATED_AT)).toEqual([]);
  });

  it("carries the incidents that overlap a day", () => {
    const days = [day("2026-10-08", { downMinutes: 3 }), day("2026-10-09", { downMinutes: 25 })];

    const listed = problemDays(days, [incident], GENERATED_AT);

    expect(listed.map((entry) => entry.summary.related)).toEqual([[incident], []]);
  });
});

describe("the incidents a day lists", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists one written up after the fact on both days it spans", () => {
    const overnight = written({
      startsAt: "2026-10-09T22:00:00.000Z",
      resolvedAt: "2026-10-10T06:00:00.000Z",
    });

    expect(listedOn("2026-10-08", [overnight])).toEqual([]);
    expect(listedOn("2026-10-09", [overnight])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-10", [overnight])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-11", [overnight])).toEqual([]);
  });

  it("does not list one that ended exactly at midnight on the day that follows", () => {
    const untilMidnight = written({
      startsAt: "2026-10-09T22:00:00.000Z",
      resolvedAt: "2026-10-10T00:00:00.000Z",
    });

    expect(listedOn("2026-10-09", [untilMidnight])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-10", [untilMidnight])).toEqual([]);
  });

  it("lists one that started exactly at midnight on that day", () => {
    const fromMidnight = written({
      startsAt: "2026-10-10T00:00:00.000Z",
      resolvedAt: "2026-10-10T01:00:00.000Z",
    });

    expect(listedOn("2026-10-09", [fromMidnight])).toEqual([]);
    expect(listedOn("2026-10-10", [fromMidnight])).toEqual(["outage-1"]);
  });

  it("runs an open one up to the document's time, not the device's", () => {
    vi.useFakeTimers({ now: Date.parse("2027-01-01T00:00:00.000Z") });
    const open = written({ startsAt: "2026-11-02T20:00:00.000Z", resolvedAt: undefined });

    expect(listedOn("2026-11-01", [open])).toEqual([]);
    expect(listedOn("2026-11-02", [open])).toEqual(["outage-1"]);
    expect(listedOn("2026-11-03", [open])).toEqual(["outage-1"]);
    expect(listedOn("2026-11-04", [open])).toEqual([]);
  });

  it("runs a maintenance window to its planned end when nobody resolved it", () => {
    const window = written({
      kind: "maintenance",
      startsAt: "2026-10-09T22:00:00.000Z",
      endsAt: "2026-10-10T01:00:00.000Z",
      resolvedAt: undefined,
    });

    expect(listedOn("2026-10-09", [window])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-10", [window])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-11", [window])).toEqual([]);
  });

  it("ends a maintenance window where it was resolved, even before its planned end", () => {
    const closedEarly = written({
      kind: "maintenance",
      startsAt: "2026-10-09T22:00:00.000Z",
      endsAt: "2026-10-11T01:00:00.000Z",
      resolvedAt: "2026-10-09T23:00:00.000Z",
    });

    expect(listedOn("2026-10-09", [closedEarly])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-10", [closedEarly])).toEqual([]);
  });

  it("ends a maintenance window at its planned end when it was resolved only after it", () => {
    const resolvedLate = written({
      kind: "maintenance",
      startsAt: "2026-10-09T22:00:00.000Z",
      endsAt: "2026-10-09T23:30:00.000Z",
      resolvedAt: "2026-10-10T00:20:00.000Z",
    });

    expect(listedOn("2026-10-09", [resolvedLate])).toEqual(["outage-1"]);
    expect(listedOn("2026-10-10", [resolvedLate])).toEqual([]);
  });

  it("leaves an incident running until it is resolved, whatever planned end it carries", () => {
    const open = written({
      startsAt: "2026-11-01T10:00:00.000Z",
      endsAt: "2026-11-01T11:00:00.000Z",
      resolvedAt: undefined,
    });

    expect(listedOn("2026-11-02", [open])).toEqual(["outage-1"]);
  });

  it("does not list one on another day", () => {
    expect(listedOn("2026-10-08", [incident])).toEqual([]);
    expect(listedOn("2026-10-10", [incident])).toEqual([]);
  });

  it("never reaches a day of the 90 for one resolved before the first of them", () => {
    const old = written({
      startsAt: "2026-07-01T10:00:00.000Z",
      resolvedAt: "2026-07-01T11:00:00.000Z",
    });
    const first = Date.parse("2026-08-06");
    const dates = Array.from({ length: 90 }, (_, index) =>
      new Date(first + index * 86_400_000).toISOString().slice(0, 10),
    );

    expect(dates.flatMap((date) => listedOn(date, [old]))).toEqual([]);
  });
});
