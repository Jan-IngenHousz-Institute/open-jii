import { endedAt } from "~/lib/incidents";

import type { DayRecord, Incident } from "@repo/monitoring/status-document";

const DAY_MS = 86_400_000;

export type DayRowKind = "outage" | "degraded" | "maintenance" | "unknown";

interface DayRow {
  kind: DayRowKind;
  minutes: number;
}

export interface DaySummary {
  isBeforeRecords: boolean;
  rows: DayRow[];
  related: Incident[];
}

// A window nobody closed runs to the document's own time, because a device clock can be hours off.
function endOfWindow(incident: Incident, generatedAt: string): number {
  return endedAt(incident) ?? Date.parse(generatedAt);
}

// The written times decide, not the minutes judged, so a problem entered after the fact still
// lists on the days it covered. A window that ends at midnight does not reach the new day.
function overlapsDay(incident: Incident, date: string, generatedAt: string): boolean {
  const dayStart = Date.parse(date);

  return (
    Date.parse(incident.startsAt) < dayStart + DAY_MS &&
    endOfWindow(incident, generatedAt) > dayStart
  );
}

// A day shows every minute it recorded, so a blip too short to colour its bar still appears here.
export function summarizeDay(
  day: DayRecord,
  incidents: Incident[],
  generatedAt: string,
): DaySummary {
  const rows: DayRow[] = [
    { kind: "outage", minutes: day.downMinutes },
    { kind: "degraded", minutes: day.degradedMinutes },
    { kind: "maintenance", minutes: day.maintenanceMinutes },
    { kind: "unknown", minutes: day.unknownMinutes },
  ];

  return {
    isBeforeRecords: day.recordedMinutes === 0,
    rows: rows.filter((row) => row.minutes > 0),
    related: incidents.filter((incident) => overlapsDay(incident, day.date, generatedAt)),
  };
}

export interface ProblemDay {
  day: DayRecord;
  summary: DaySummary;
}

// Newest first, and any recorded minute counts, so a blip too short to colour its bar is listed.
export function problemDays(
  days: DayRecord[],
  incidents: Incident[],
  generatedAt: string,
): ProblemDay[] {
  return days
    .map((day) => ({ day, summary: summarizeDay(day, incidents, generatedAt) }))
    .filter(({ summary }) => summary.rows.length > 0)
    .reverse();
}
