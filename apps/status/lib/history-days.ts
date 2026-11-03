import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";
import type { DayRecord } from "@repo/monitoring/status-document";

const DAY_MS = 86_400_000;

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function emptyDay(date: string): DayRecord {
  return {
    date,
    state: "none",
    recordedMinutes: 0,
    downMinutes: 0,
    degradedMinutes: 0,
    maintenanceMinutes: 0,
    unknownMinutes: 0,
    incidentIds: [],
  };
}

// The document keeps days only from the first record, so the strip's missing start is padded
// with no-record days dated backwards from that first record.
export function padDays(days: DayRecord[], firstRecordDate: string): DayRecord[] {
  const missing = STATUS_HISTORY_DAYS - days.length;
  const padding = Array.from({ length: missing }, (_, index) =>
    emptyDay(shiftDate(firstRecordDate, index - missing)),
  );

  return [...padding, ...days];
}
