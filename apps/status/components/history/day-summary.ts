import type { DayRecord, Incident } from "@repo/monitoring/status-document";

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

// A day shows every minute it recorded, so a blip too short to colour its bar still appears here.
export function summarizeDay(day: DayRecord, incidents: Incident[]): DaySummary {
  const rows: DayRow[] = [
    { kind: "outage", minutes: day.downMinutes },
    { kind: "degraded", minutes: day.degradedMinutes },
    { kind: "maintenance", minutes: day.maintenanceMinutes },
    { kind: "unknown", minutes: day.unknownMinutes },
  ];

  return {
    isBeforeRecords: day.recordedMinutes === 0,
    rows: rows.filter((row) => row.minutes > 0),
    related: incidents.filter((incident) => day.incidentIds.includes(incident.id)),
  };
}

export interface ProblemDay {
  day: DayRecord;
  summary: DaySummary;
}

// Newest first, and any recorded minute counts, so a blip too short to colour its bar is listed.
export function problemDays(days: DayRecord[], incidents: Incident[]): ProblemDay[] {
  return days
    .map((day) => ({ day, summary: summarizeDay(day, incidents) }))
    .filter(({ summary }) => summary.rows.length > 0)
    .reverse();
}
