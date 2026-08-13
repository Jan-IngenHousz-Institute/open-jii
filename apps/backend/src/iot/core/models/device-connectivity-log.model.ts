import type { DeviceLifecycleEvent, DeviceSession } from "@repo/api/domains/iot/iot.schema";

/** A lifecycle-event row as the warehouse returns it, before normalization. */
export interface LifecycleEventRow {
  eventType: string | null;
  eventTimestamp: string | null;
  disconnectReason: string | null;
  sessionIdentifier: string | null;
}

/** An in-progress session while pairing the ordered event log. */
interface OpenSession {
  start: string;
  openStart: boolean;
  sessionIdentifier: string | null;
}

/** Accumulator for the event-pairing fold. */
interface PairingState {
  open: OpenSession | null;
  sessions: DeviceSession[];
}

/**
 * The connectivity record of one device over a queried range: lifecycle-event
 * rows normalized and paired into sessions, with uptime over the elapsed part
 * of the range.
 *
 * Pairing rules: a connect opens a session (repeats keep the earliest start,
 * the latest connect's identifier names the live MQTT session); a disconnect
 * closes the open session it belongs to; a disconnect opening the range
 * implies a session running since range start; stale disconnects from an
 * older interleaved MQTT session and later orphans change nothing. A session
 * still open after the last event runs to the range end, clamped to now.
 */
export class DeviceConnectivityLog {
  readonly events: DeviceLifecycleEvent[];
  readonly sessions: DeviceSession[];

  private readonly rangeStartMs: number;
  private readonly rangeEndMs: number;

  constructor(rows: LifecycleEventRow[], from: string, to: string) {
    this.rangeStartMs = new Date(from).getTime();
    this.rangeEndMs = Math.min(Date.now(), new Date(to).getTime());
    this.events = this.normalize(rows);
    this.sessions = this.pair(from);
  }

  /** Uptime percent over the elapsed range; null when the range holds no evidence. */
  get uptimePercent(): number | null {
    const elapsed = this.rangeEndMs - this.rangeStartMs;
    if (this.events.length === 0 || elapsed <= 0) {
      return null;
    }

    const connectedMs = this.sessions.reduce((total, session) => {
      const start = Math.max(this.rangeStartMs, new Date(session.start).getTime());
      const end = session.end === null ? this.rangeEndMs : new Date(session.end).getTime();
      return total + Math.max(0, Math.min(this.rangeEndMs, end) - start);
    }, 0);

    return Math.min(100, (connectedMs / elapsed) * 100);
  }

  // Rows with an unknown event type or no timestamp carry nothing pairable.
  private normalize(rows: LifecycleEventRow[]): DeviceLifecycleEvent[] {
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

  private pair(from: string): DeviceSession[] {
    const initial: PairingState = { open: null, sessions: [] };
    const { open, sessions } = this.events.reduce(
      (state, event, index) => this.applyEvent(state, event, index, from),
      initial,
    );

    return open === null ? sessions : [...sessions, this.closeAtRangeEnd(open)];
  }

  private applyEvent(
    state: PairingState,
    event: DeviceLifecycleEvent,
    index: number,
    from: string,
  ): PairingState {
    if (event.eventType === "connected") {
      return { ...state, open: this.extend(state.open, event) };
    }

    const isLeadingDisconnect = index === 0;
    const open =
      state.open ??
      (isLeadingDisconnect ? { start: from, openStart: true, sessionIdentifier: null } : null);
    if (open === null || this.isStaleDisconnect(open, event)) {
      return state;
    }

    return { open: null, sessions: [...state.sessions, this.close(open, event)] };
  }

  private extend(open: OpenSession | null, event: DeviceLifecycleEvent): OpenSession {
    return open === null
      ? {
          start: event.eventTimestamp,
          openStart: false,
          sessionIdentifier: event.sessionIdentifier,
        }
      : { ...open, sessionIdentifier: event.sessionIdentifier };
  }

  // Unknown identifiers pair leniently; a positive mismatch is an older
  // MQTT session's delayed disconnect and must not close the live one.
  private isStaleDisconnect(open: OpenSession, event: DeviceLifecycleEvent): boolean {
    return (
      open.sessionIdentifier !== null &&
      event.sessionIdentifier !== null &&
      open.sessionIdentifier !== event.sessionIdentifier
    );
  }

  private close(open: OpenSession, event: DeviceLifecycleEvent): DeviceSession {
    const durationMs = new Date(event.eventTimestamp).getTime() - new Date(open.start).getTime();

    return {
      start: open.start,
      end: event.eventTimestamp,
      openStart: open.openStart,
      durationSeconds: Math.max(0, durationMs / 1000),
      disconnectReason: event.disconnectReason,
    };
  }

  private closeAtRangeEnd(open: OpenSession): DeviceSession {
    return {
      start: open.start,
      end: null,
      openStart: open.openStart,
      durationSeconds: Math.max(0, (this.rangeEndMs - new Date(open.start).getTime()) / 1000),
      disconnectReason: null,
    };
  }
}
