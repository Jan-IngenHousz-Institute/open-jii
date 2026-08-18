import { Inject, Injectable } from "@nestjs/common";

import type { DeviceLifecycleEvent, DeviceSession } from "@repo/api/domains/iot/iot.schema";
import { deriveDeviceConnectivity } from "@repo/api/transforms/device-connectivity";

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
 * Connectivity sessions and uptime for one thing over a range: fetches the
 * ordered lifecycle-event log and hands derivation to the shared transform.
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
    const derivation = deriveDeviceConnectivity(
      eventsResult.value.slice(0, EVENT_QUERY_CAP),
      from,
      to,
    );

    return success({
      events: derivation.events,
      sessions: derivation.sessions,
      // A percentage over a capped window would read as fact while describing
      // only the part that fit; the sessions themselves are real and stay.
      uptimePercent: truncated ? null : derivation.uptimePercent,
      truncated,
    });
  }
}
