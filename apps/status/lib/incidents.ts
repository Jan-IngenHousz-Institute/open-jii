import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";
import type { Incident, StatusComponentId } from "@repo/monitoring/status-document";

export type IncidentUpdateEntry = Incident["updates"][number];

export interface IncidentGroups {
  open: Incident[];
  planned: Incident[];
  past: Incident[];
}

const DAY_MS = 86_400_000;

// Planned work also ends at its window, so a window nobody closed does not stay open.
function endedAt(incident: Incident): number | undefined {
  const ends = [incident.resolvedAt, incident.kind === "maintenance" ? incident.endsAt : undefined]
    .filter((at) => at !== undefined)
    .map((at) => Date.parse(at));

  return ends.length === 0 ? undefined : Math.min(...ends);
}

// An incident cannot start in the future, so a clock that runs behind never hides one.
export function groupIncidents(incidents: Incident[], now: number): IncidentGroups {
  const horizon = now - STATUS_HISTORY_DAYS * DAY_MS;
  const groups: IncidentGroups = { open: [], planned: [], past: [] };

  for (const incident of incidents) {
    const ended = endedAt(incident);
    const hasEnded = ended !== undefined && ended <= now;

    if (hasEnded) {
      if (ended >= horizon) {
        groups.past.push(incident);
      }
    } else if (incident.kind === "maintenance") {
      groups.planned.push(incident);
    } else {
      groups.open.push(incident);
    }
  }

  groups.open.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  groups.planned.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  groups.past.sort((a, b) => (endedAt(b) ?? 0) - (endedAt(a) ?? 0));

  return groups;
}

export function isInProgress(incident: Incident, now: number): boolean {
  return Date.parse(incident.startsAt) <= now;
}

// One window with no end makes the whole answer open-ended.
export function maintenanceEndsAt(
  windows: Incident[],
  componentIds: StatusComponentId[],
): string | undefined {
  const covering = windows.filter((maintenance) =>
    maintenance.components.some((id) => componentIds.includes(id)),
  );
  const ends = covering.flatMap((maintenance) =>
    maintenance.endsAt === undefined ? [] : [maintenance.endsAt],
  );
  const isOpenEnded = covering.length === 0 || ends.length < covering.length;

  return isOpenEnded
    ? undefined
    : ends.reduce((latest, end) => (Date.parse(end) > Date.parse(latest) ? end : latest));
}

export function newestUpdatesFirst(incident: Incident): IncidentUpdateEntry[] {
  return [...incident.updates].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}
