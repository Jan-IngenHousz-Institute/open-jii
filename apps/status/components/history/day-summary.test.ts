import { describe, expect, it } from "vitest";

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
    incidentIds: [],
    ...minutes,
  };
}

const incident: Incident = {
  id: "outage-1",
  kind: "incident",
  title: "Measurements are not reaching the platform",
  impact: "outage",
  components: ["data-intake"],
  startsAt: "2026-10-09T10:00:00.000Z",
  updates: [],
};

describe("problemDays", () => {
  it("lists the days that were not fully operational, newest first", () => {
    const days = [
      day("2026-10-01", { degradedMinutes: 20 }),
      day("2026-10-02"),
      day("2026-10-03", { downMinutes: 42, degradedMinutes: 9 }),
      day("2026-10-04"),
    ];

    expect(problemDays(days, []).map((entry) => entry.day.date)).toEqual([
      "2026-10-03",
      "2026-10-01",
    ]);
  });

  it("keeps a blip too short to colour its bar", () => {
    const listed = problemDays([day("2026-10-01", { degradedMinutes: 4 })], []);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.summary.rows).toEqual([{ kind: "degraded", minutes: 4 }]);
  });

  it("counts maintenance and minutes the checks could not run", () => {
    const listed = problemDays(
      [day("2026-10-01", { maintenanceMinutes: 60 }), day("2026-10-02", { unknownMinutes: 4 })],
      [],
    );

    expect(listed.map((entry) => entry.summary.rows[0]?.kind)).toEqual(["unknown", "maintenance"]);
  });

  it("leaves out days with no record and days that were clean", () => {
    const days = [day("2026-10-01", { recordedMinutes: 0 }), day("2026-10-02")];

    expect(problemDays(days, [])).toEqual([]);
  });

  it("carries the incidents a day relates to", () => {
    const days = [day("2026-10-09", { downMinutes: 25, incidentIds: ["outage-1"] })];

    expect(problemDays(days, [incident])[0]?.summary.related).toEqual([incident]);
    expect(summarizeDay(day("2026-10-09", { incidentIds: ["other"] }), [incident]).related).toEqual(
      [],
    );
  });
});
