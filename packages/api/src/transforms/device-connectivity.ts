import type { DeviceLifecycleEvent, DeviceSession } from "../domains/iot/iot.schema";

/**
 * Domain-pure derivation of a device's connectivity over a queried range:
 * lifecycle-event rows normalized and paired into sessions, with uptime over
 * the elapsed part of the range.
 *
 * Pairing rules: a connect opens a session (repeats keep the earliest start,
 * the latest connect's identifier names the live MQTT session); a disconnect
 * closes the open session it belongs to; a disconnect opening the range
 * implies a session running since range start; stale disconnects from an
 * older interleaved MQTT session and later orphans change nothing. A session
 * still open after the last event runs to the range end, clamped to now.
 */

/** A lifecycle-event row as the warehouse returns it, before normalization. */
export interface LifecycleEventRow {
  eventType: string | null;
  eventTimestamp: string | null;
  disconnectReason: string | null;
  sessionIdentifier: string | null;
}

export interface DeviceConnectivityDerivation {
  events: DeviceLifecycleEvent[];
  sessions: DeviceSession[];
  uptimePercent: number | null;
}

interface OpenSession {
  start: string;
  openStart: boolean;
  sessionIdentifier: string | null;
}

interface PairingState {
  open: OpenSession | null;
  sessions: DeviceSession[];
}

export function deriveDeviceConnectivity(
  rows: LifecycleEventRow[],
  from: string,
  to: string,
  now = Date.now(),
): DeviceConnectivityDerivation {
  const rangeStartMs = new Date(from).getTime();
  const rangeEndMs = Math.min(now, new Date(to).getTime());

  const events = normalize(rows);
  const sessions = pairSessions(events, from, rangeEndMs);

  return {
    events,
    sessions,
    uptimePercent: deriveUptime(events, sessions, rangeStartMs, rangeEndMs),
  };
}

// Rows with an unknown event type or no timestamp carry nothing pairable.
function normalize(rows: LifecycleEventRow[]): DeviceLifecycleEvent[] {
  return rows.flatMap((row) =>
    (row.eventType === "connected" || row.eventType === "disconnected") &&
    row.eventTimestamp !== null
      ? [
          {
            eventType: row.eventType,
            eventTimestamp: row.eventTimestamp,
            disconnectReason: row.disconnectReason,
            sessionIdentifier: row.sessionIdentifier,
          },
        ]
      : [],
  );
}

function pairSessions(
  events: DeviceLifecycleEvent[],
  from: string,
  rangeEndMs: number,
): DeviceSession[] {
  const initial: PairingState = { open: null, sessions: [] };
  const { open, sessions } = events.reduce(
    (state, event, index) => applyEvent(state, event, index, from),
    initial,
  );

  return open === null ? sessions : [...sessions, closeAtRangeEnd(open, rangeEndMs)];
}

// Advance the pairing by one event: a connect opens or extends the session,
// a matching disconnect closes it, stale and orphan disconnects change nothing.
function applyEvent(
  state: PairingState,
  event: DeviceLifecycleEvent,
  index: number,
  from: string,
): PairingState {
  if (event.eventType === "connected") {
    return { ...state, open: extendOpenSession(state.open, event) };
  }

  // Only the range's very first event may imply a session that was already
  // running at range start; any later unmatched disconnect is an orphan.
  const isLeadingDisconnect = index === 0;
  const open =
    state.open ??
    (isLeadingDisconnect ? { start: from, openStart: true, sessionIdentifier: null } : null);
  if (open === null || isStaleDisconnect(open, event)) {
    return state;
  }

  return { open: null, sessions: [...state.sessions, closeSession(open, event)] };
}

// A repeated connect keeps the earliest start of the open session; the latest
// connect's identifier names the live MQTT session.
function extendOpenSession(open: OpenSession | null, event: DeviceLifecycleEvent): OpenSession {
  return open === null
    ? { start: event.eventTimestamp, openStart: false, sessionIdentifier: event.sessionIdentifier }
    : { ...open, sessionIdentifier: event.sessionIdentifier };
}

// Unknown identifiers pair leniently; a positive mismatch is an older MQTT
// session's delayed disconnect and must not close the live one.
function isStaleDisconnect(open: OpenSession, event: DeviceLifecycleEvent): boolean {
  return (
    open.sessionIdentifier !== null &&
    event.sessionIdentifier !== null &&
    open.sessionIdentifier !== event.sessionIdentifier
  );
}

function closeSession(open: OpenSession, event: DeviceLifecycleEvent): DeviceSession {
  const durationMs = new Date(event.eventTimestamp).getTime() - new Date(open.start).getTime();

  return {
    start: open.start,
    end: event.eventTimestamp,
    openStart: open.openStart,
    durationSeconds: Math.max(0, durationMs / 1000),
    disconnectReason: event.disconnectReason,
  };
}

// Still connected at range end: the duration runs to now for live ranges.
function closeAtRangeEnd(open: OpenSession, rangeEndMs: number): DeviceSession {
  return {
    start: open.start,
    end: null,
    openStart: open.openStart,
    durationSeconds: Math.max(0, (rangeEndMs - new Date(open.start).getTime()) / 1000),
    disconnectReason: null,
  };
}

// Uptime over the elapsed part of the range; without events the state in the
// range is unknown, not zero.
function deriveUptime(
  events: DeviceLifecycleEvent[],
  sessions: DeviceSession[],
  rangeStartMs: number,
  rangeEndMs: number,
): number | null {
  const elapsed = rangeEndMs - rangeStartMs;
  if (events.length === 0 || elapsed <= 0) {
    return null;
  }

  const connectedMs = sessions.reduce((total, session) => {
    const start = Math.max(rangeStartMs, new Date(session.start).getTime());
    const end = session.end === null ? rangeEndMs : new Date(session.end).getTime();
    return total + Math.max(0, Math.min(rangeEndMs, end) - start);
  }, 0);

  return Math.min(100, (connectedMs / elapsed) * 100);
}
