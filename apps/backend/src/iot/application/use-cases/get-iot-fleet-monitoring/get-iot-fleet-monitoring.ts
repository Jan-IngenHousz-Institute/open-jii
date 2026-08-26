import { Inject, Injectable, Logger } from "@nestjs/common";

import type { IotFleetMonitoring, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { Result, success } from "../../../../common/utils/fp-utils";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type {
  DatabricksPort,
  GroupLifecycleEventRow,
  GroupThroughputRow,
} from "../../../core/ports/databricks.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

export interface FleetMonitoringWindow {
  from: string;
  to: string;
  bucket: MonitoringBucket;
}

/** Latest-first event cap: enough for a busy window without unbounded payloads. */
const EVENT_LIMIT = 200;

const BUCKET_MS = { hour: 3_600_000, day: 86_400_000 } as const;

/** Bucket count of the window, for sizing the grouped scans' row ceilings. */
function bucketsInWindow(window: FleetMonitoringWindow): number {
  const span = new Date(window.to).getTime() - new Date(window.from).getTime();
  return Math.ceil(span / BUCKET_MS[window.bucket]) + 1;
}

/**
 * The devices overview's one orchestrated read, over every device the caller
 * can read: last-data, per-device throughput and lifecycle events, each as ONE
 * grouped scan over the fleet's thing names. Identity and live connectivity
 * stay on the list endpoint; a warehouse fact failing sets
 * `pipelineUnavailable` and empties that fact, never the response.
 */
@Injectable()
export class GetIotFleetMonitoringUseCase {
  private readonly logger = new Logger(GetIotFleetMonitoringUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    userId: string,
    window: FleetMonitoringWindow,
  ): Promise<Result<IotFleetMonitoring>> {
    this.logger.log({
      msg: "Getting fleet monitoring",
      operation: "getIotFleetMonitoring",
      userId,
      bucket: window.bucket,
    });

    const devicesResult = await this.deviceRepository.listAccessible(userId);
    if (devicesResult.isFailure()) {
      return devicesResult;
    }

    const devices = devicesResult.value;
    if (devices.length === 0) {
      return success({ devices: [], throughput: [], events: [], pipelineUnavailable: false });
    }

    const thingNames = devices.map((device) => device.thingName);
    const deviceIdByThing = new Map(devices.map((device) => [device.thingName, device.id]));

    const [activity, throughput, events] = await Promise.all([
      this.lookupActivity(thingNames),
      this.lookupThroughput(thingNames, window, bucketsInWindow(window) * thingNames.length),
      this.lookupEvents(thingNames, window),
    ]);

    const toDeviceId = (clientId: string | null) =>
      clientId === null ? null : (deviceIdByThing.get(clientId) ?? null);

    return success({
      devices: devices.map((device) => ({
        deviceId: device.id,
        lastDataAt: activity?.get(device.thingName) ?? null,
      })),
      throughput: (throughput ?? []).map((row) => ({
        bucketStart: row.bucketStart,
        deviceId: toDeviceId(row.clientId),
        count: row.count,
      })),
      events: (events ?? []).map((row) => ({
        deviceId: toDeviceId(row.clientId),
        eventType: row.eventType,
        eventTimestamp: row.eventTimestamp,
        disconnectReason: row.disconnectReason,
      })),
      pipelineUnavailable: activity === null || throughput === null || events === null,
    });
  }

  private async lookupActivity(thingNames: string[]): Promise<Map<string, string | null> | null> {
    const result = await this.databricksPort.getDevicesLastActivity(thingNames);
    if (result.isFailure()) {
      this.warn("Warehouse last-activity lookup failed", result);
      return null;
    }
    return result.value;
  }

  private async lookupThroughput(
    thingNames: string[],
    window: FleetMonitoringWindow,
    limit: number,
  ): Promise<GroupThroughputRow[] | null> {
    const result = await this.databricksPort.getDevicesThroughput(
      thingNames,
      window.from,
      window.to,
      window.bucket,
      limit,
    );
    if (result.isFailure()) {
      this.warn("Warehouse throughput lookup failed", result);
      return null;
    }
    return result.value;
  }

  private async lookupEvents(
    thingNames: string[],
    window: FleetMonitoringWindow,
  ): Promise<GroupLifecycleEventRow[] | null> {
    const result = await this.databricksPort.getDevicesLifecycleEvents(
      thingNames,
      window.from,
      window.to,
      EVENT_LIMIT,
    );
    if (result.isFailure()) {
      this.warn("Warehouse lifecycle-event lookup failed", result);
      return null;
    }
    return result.value;
  }

  private warn(msg: string, result: { error: { code: string } }) {
    this.logger.warn({
      msg,
      operation: "getIotFleetMonitoring",
      errorCode: result.error.code,
    });
  }
}
