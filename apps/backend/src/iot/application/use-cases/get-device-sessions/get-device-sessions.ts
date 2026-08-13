import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DeviceLifecycleEvent, DeviceSession } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

// One more row than the cap detects truncation without a count query.
const EVENT_QUERY_CAP = 1000;

export interface DeviceSessionsResult {
  events: DeviceLifecycleEvent[];
  sessions: DeviceSession[];
  uptimePercent: number | null;
  truncated: boolean;
}

/**
 * Connectivity sessions and uptime for one thing over a range, derived from
 * the ordered lifecycle-event log.
 */
@Injectable()
export class GetDeviceSessionsUseCase {
  private readonly logger = new Logger(GetDeviceSessionsUseCase.name);

  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(thingName: string, from: string, to: string): Promise<Result<DeviceSessionsResult>> {
    const eventsResult = await this.databricksPort.getDeviceLifecycleEvents(
      thingName,
      from,
      to,
      EVENT_QUERY_CAP + 1,
    );
    if (eventsResult.isFailure()) {
      return failure(eventsResult.error);
    }

    const truncated = eventsResult.value.length > EVENT_QUERY_CAP;
    const events = eventsResult.value
      .slice(0, EVENT_QUERY_CAP)
      .flatMap((row): DeviceLifecycleEvent[] => {
        if (
          (row.eventType !== "connected" && row.eventType !== "disconnected") ||
          row.eventTimestamp === null
        ) {
          return [];
        }
        return [
          {
            eventType: row.eventType,
            eventTimestamp: row.eventTimestamp,
            disconnectReason: row.disconnectReason,
            sessionIdentifier: row.sessionIdentifier,
          },
        ];
      });

    const sessions = this.deriveSessions(events, from, to);
    const uptimePercent = this.deriveUptime(sessions, events, from, to);

    return success({ events, sessions, uptimePercent, truncated });
  }

  // Pair ordered events into sessions, clamped to the range. A leading
  // disconnect means the device was online at range start (open start); a
  // trailing connect means it still is (open end).
  private deriveSessions(
    events: DeviceLifecycleEvent[],
    from: string,
    to: string,
  ): DeviceSession[] {
    const rangeEnd = Math.min(Date.now(), new Date(to).getTime());
    const sessions: DeviceSession[] = [];
    let open: { start: string; openStart: boolean } | null = null;

    for (const event of events) {
      if (event.eventType === "connected") {
        // A repeated connect keeps the earliest start of the open session.
        open = open ?? { start: event.eventTimestamp, openStart: false };
        continue;
      }

      const start = open ?? { start: from, openStart: true };
      const durationSeconds = Math.max(
        0,
        (new Date(event.eventTimestamp).getTime() - new Date(start.start).getTime()) / 1000,
      );
      sessions.push({
        start: start.start,
        end: event.eventTimestamp,
        openStart: start.openStart,
        durationSeconds,
        disconnectReason: event.disconnectReason,
      });
      open = null;
    }

    if (open) {
      const durationSeconds = Math.max(0, (rangeEnd - new Date(open.start).getTime()) / 1000);
      sessions.push({
        start: open.start,
        end: null,
        openStart: open.openStart,
        durationSeconds,
        disconnectReason: null,
      });
    }

    return sessions;
  }

  // Uptime over the elapsed part of the range. Without any events the state in
  // the range is unknown, not zero.
  private deriveUptime(
    sessions: DeviceSession[],
    events: DeviceLifecycleEvent[],
    from: string,
    to: string,
  ): number | null {
    if (events.length === 0) {
      return null;
    }

    const rangeStart = new Date(from).getTime();
    const rangeEnd = Math.min(Date.now(), new Date(to).getTime());
    const elapsed = rangeEnd - rangeStart;
    if (elapsed <= 0) {
      return null;
    }

    const connectedMs = sessions.reduce((total, session) => {
      const start = Math.max(rangeStart, new Date(session.start).getTime());
      const end = session.end === null ? rangeEnd : new Date(session.end).getTime();
      return total + Math.max(0, Math.min(rangeEnd, end) - start);
    }, 0);

    return Math.min(100, (connectedMs / elapsed) * 100);
  }
}
