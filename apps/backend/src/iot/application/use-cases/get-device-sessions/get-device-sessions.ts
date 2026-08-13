import { Inject, Injectable } from "@nestjs/common";

import type { DeviceLifecycleEvent, DeviceSession } from "@repo/api/domains/iot/iot.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { DeviceConnectivityLog } from "../../../core/models/device-connectivity-log.model";
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
 * Connectivity sessions and uptime for one thing over a range: fetches the
 * ordered lifecycle-event log and hands derivation to the domain model.
 */
@Injectable()
export class GetDeviceSessionsUseCase {
  constructor(
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DeviceSessionsResult>> {
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
    const log = new DeviceConnectivityLog(eventsResult.value.slice(0, EVENT_QUERY_CAP), from, to);

    return success({
      events: log.events,
      sessions: log.sessions,
      uptimePercent: log.uptimePercent,
      truncated,
    });
  }
}
