import type { DeviceMonitoring, DeviceSession } from "@repo/api/domains/iot/iot.schema";

/** Availability of one bucket: up, partially up, down, or no evidence. */
export type BucketAvailability = "up" | "partial" | "down" | "unknown";

export interface AvailabilitySlice {
  start: string;
  end: string;
  state: BucketAvailability;
  /** Share of the slice the device was connected, 0-1. */
  onlineRatio: number;
}

export interface Outage {
  start: string;
  /** Null when the outage is still open at the end of the window. */
  end: string | null;
  durationSeconds: number;
  reason: string | null;
}

interface Interval {
  start: number;
  end: number;
}

function toIntervals(sessions: DeviceSession[], rangeEndMs: number): Interval[] {
  return sessions
    .map((session) => ({
      start: new Date(session.start).getTime(),
      end: session.end === null ? rangeEndMs : new Date(session.end).getTime(),
    }))
    .sort((a, b) => a.start - b.start);
}

/** Split the window into slices and grade each one. */
export function buildAvailabilitySlices(
  monitoring: DeviceMonitoring,
  axis: string[],
  to: string,
  now = Date.now(),
): AvailabilitySlice[] {
  const rangeEndMs = Math.min(now, new Date(to).getTime());
  const online = toIntervals(monitoring.sessions, rangeEndMs);
  const hasEvidence = monitoring.events.length > 0;

  return axis.flatMap((start, position) => {
    const startMs = new Date(start).getTime();
    const endMs = position + 1 < axis.length ? new Date(axis[position + 1]).getTime() : rangeEndMs;
    if (endMs <= startMs) {
      return [];
    }

    const connectedMs = online.reduce(
      (total, interval) =>
        total + Math.max(0, Math.min(endMs, interval.end) - Math.max(startMs, interval.start)),
      0,
    );
    const onlineRatio = connectedMs / (endMs - startMs);

    return [
      {
        start,
        end: new Date(endMs).toISOString(),
        onlineRatio,
        state: gradeSlice(onlineRatio, hasEvidence),
      },
    ];
  });
}

function gradeSlice(onlineRatio: number, hasEvidence: boolean): BucketAvailability {
  if (!hasEvidence) {
    return "unknown";
  }
  if (onlineRatio >= 0.99) {
    return "up";
  }
  if (onlineRatio <= 0.01) {
    return "down";
  }
  return "partial";
}

/** The gaps between sessions, with the reason the preceding one ended. */
export function deriveOutages(
  monitoring: DeviceMonitoring,
  from: string,
  to: string,
  now = Date.now(),
): Outage[] {
  const rangeEndMs = Math.min(now, new Date(to).getTime());
  const rangeStartMs = new Date(from).getTime();

  // Without any lifecycle evidence the window is unknown, not down.
  if (monitoring.events.length === 0) {
    return [];
  }

  // Evidence but no session at all: the device was down for the whole window.
  const first = monitoring.sessions.at(0);
  if (first === undefined) {
    return [
      {
        start: from,
        end: null,
        durationSeconds: Math.max(0, (rangeEndMs - rangeStartMs) / 1000),
        reason: null,
      },
    ];
  }

  // A window that opens before the first session opens with an outage; its
  // cause happened before the window, so no reason is claimed.
  const leadingGapSeconds = (new Date(first.start).getTime() - rangeStartMs) / 1000;
  const leading: Outage[] =
    leadingGapSeconds > 0
      ? [
          {
            start: from,
            end: first.start,
            durationSeconds: leadingGapSeconds,
            reason: null,
          },
        ]
      : [];

  const between = monitoring.sessions.flatMap((session, position) => {
    // A session with no end is still running, so nothing follows it.
    const start = session.end;
    if (start === null) {
      return [];
    }

    const next = monitoring.sessions.at(position + 1);
    const endMs = next === undefined ? rangeEndMs : new Date(next.start).getTime();
    const durationSeconds = Math.max(0, (endMs - new Date(start).getTime()) / 1000);
    if (durationSeconds === 0) {
      return [];
    }

    return [
      {
        start,
        end: next?.start ?? null,
        durationSeconds,
        reason: session.disconnectReason,
      },
    ];
  });

  return [...leading, ...between];
}
