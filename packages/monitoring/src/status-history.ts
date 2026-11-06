import { DAY_MINUTES, STATUS_HISTORY_DAYS } from "./status-document.js";
import type { ComponentState, DayRecord, DayState } from "./status-document.js";

const MINUTE_MS = 60_000;

/** Short blips stay visible in the day's details but do not colour the bar. */
export const DAY_DEGRADED_MINUTES = 5;

type DayCounts = Pick<
  DayRecord,
  "recordedMinutes" | "downMinutes" | "degradedMinutes" | "maintenanceMinutes" | "unknownMinutes"
>;

/** Minutes since the epoch, the unit every record is kept in so a minute can be counted only once. */
export function minuteOf(at: Date): number {
  return Math.floor(at.getTime() / MINUTE_MS);
}

function dateOfMinute(minute: number): string {
  return new Date(minute * MINUTE_MS).toISOString().slice(0, 10);
}

function firstMinuteOfDayAfter(minute: number): number {
  return (Math.floor(minute / DAY_MINUTES) + 1) * DAY_MINUTES;
}

/**
 * The worst state a day measured. Degraded minutes colour it only from `DAY_DEGRADED_MINUTES`, and
 * unknown minutes never do, since a gap in our checks says nothing about the service. A day with
 * none measured has no colour at all.
 */
export function dayState(counts: DayCounts): DayState {
  const measuredMinutes = counts.recordedMinutes - counts.unknownMinutes;

  if (counts.downMinutes > 0) {
    return "outage";
  }
  if (counts.degradedMinutes >= DAY_DEGRADED_MINUTES) {
    return "degraded";
  }
  if (counts.maintenanceMinutes > 0) {
    return "maintenance";
  }
  return measuredMinutes > 0 ? "operational" : "none";
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

/** Oldest first, and no more than the history the page shows. */
function trimDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-STATUS_HISTORY_DAYS);
}

function addToDay(
  days: DayRecord[],
  date: string,
  added: DayCounts,
  incidentIds: string[],
): DayRecord[] {
  const current = days.find((day) => day.date === date) ?? emptyDay(date);
  const counts: DayCounts = {
    recordedMinutes: current.recordedMinutes + added.recordedMinutes,
    downMinutes: current.downMinutes + added.downMinutes,
    degradedMinutes: current.degradedMinutes + added.degradedMinutes,
    maintenanceMinutes: current.maintenanceMinutes + added.maintenanceMinutes,
    unknownMinutes: current.unknownMinutes + added.unknownMinutes,
  };
  const updated: DayRecord = {
    ...counts,
    date,
    state: dayState(counts),
    incidentIds: [...new Set([...current.incidentIds, ...incidentIds])],
  };

  return trimDays([...days.filter((day) => day.date !== date), updated]);
}

/** Counts one minute on its UTC day. The caller guarantees it has not been recorded before. */
export function recordMinute(
  days: DayRecord[],
  minute: number,
  outcome: ComponentState,
  incidentIds: string[],
): DayRecord[] {
  const added: DayCounts = {
    recordedMinutes: 1,
    downMinutes: outcome === "outage" ? 1 : 0,
    degradedMinutes: outcome === "degraded" ? 1 : 0,
    maintenanceMinutes: outcome === "maintenance" ? 1 : 0,
    unknownMinutes: 0,
  };

  return addToDay(days, dateOfMinute(minute), added, incidentIds);
}

/**
 * Counts the minutes from `fromMinute` to `toMinute`, both included, as ones our checks could not
 * run, each on its own UTC day. A gap longer than the history is cut to it, since the rest would be
 * trimmed at once.
 */
export function recordUnknown(
  days: DayRecord[],
  fromMinute: number,
  toMinute: number,
): DayRecord[] {
  let result = days;

  for (
    let start = Math.max(fromMinute, toMinute + 1 - STATUS_HISTORY_DAYS * DAY_MINUTES);
    start <= toMinute;
    start = firstMinuteOfDayAfter(start)
  ) {
    const end = Math.min(toMinute, firstMinuteOfDayAfter(start) - 1);
    const unknown = end - start + 1;

    result = addToDay(
      result,
      dateOfMinute(start),
      {
        recordedMinutes: unknown,
        downMinutes: 0,
        degradedMinutes: 0,
        maintenanceMinutes: 0,
        unknownMinutes: unknown,
      },
      [],
    );
  }

  return result;
}

function sum(days: DayRecord[], pick: (day: DayRecord) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

/**
 * Time the component was up, as a percent. Unknown minutes count against it, and maintenance is
 * left out of both sides, so planned work neither costs a component nor flatters it.
 */
export function uptimePercent(days: DayRecord[]): number {
  const expectedMinutes =
    sum(days, (day) => day.recordedMinutes) - sum(days, (day) => day.maintenanceMinutes);
  const lostMinutes = sum(days, (day) => day.downMinutes) + sum(days, (day) => day.unknownMinutes);

  if (expectedMinutes === 0) {
    return 100;
  }

  const percent = Math.round(10_000 * (1 - lostMinutes / expectedMinutes)) / 100;

  // A single lost minute in 90 days rounds to 100, which would claim there was none.
  return lostMinutes > 0 ? Math.min(percent, 99.99) : percent;
}

export function totalDegradedMinutes(days: DayRecord[]): number {
  return sum(days, (day) => day.degradedMinutes);
}
