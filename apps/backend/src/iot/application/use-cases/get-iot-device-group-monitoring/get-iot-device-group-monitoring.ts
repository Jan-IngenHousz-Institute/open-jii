import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { IotDeviceGroupMemberThingDto } from "../../../core/models/iot-device-group.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, ThingConnectivity } from "../../../core/ports/aws.port";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type {
  DatabricksPort,
  GroupExperimentRow,
  GroupFirmwareRow,
  GroupLifecycleEventRow,
  GroupThroughputRow,
} from "../../../core/ports/databricks.port";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";

export interface MonitoringWindow {
  from: string;
  to: string;
  bucket: "hour" | "day";
}

export interface IotDeviceGroupMemberHealthDto {
  deviceId: string;
  name: string | null;
  serialNumber: string;
  deviceType: IotDeviceGroupMemberThingDto["deviceType"];
  connectivity: { connected: boolean; lastSeenAt: string | null } | null;
  lastDataAt: string | null;
}

export interface IotDeviceGroupMonitoringDto {
  members: IotDeviceGroupMemberHealthDto[];
  throughput: { bucketStart: string | null; deviceId: string | null; count: number }[];
  dataByExperiment: { bucketStart: string | null; experimentId: string | null; count: number }[];
  firmware: { deviceId: string | null; version: string | null; lastSeen: string | null }[];
  events: {
    deviceId: string | null;
    eventType: string | null;
    eventTimestamp: string | null;
    disconnectReason: string | null;
  }[];
  pipelineUnavailable: boolean;
}

/** Latest-first event cap: enough for a busy window without unbounded payloads. */
const EVENT_LIMIT = 200;

/** A member rarely runs many versions in one window; a ceiling, not a target. */
const FIRMWARE_VERSIONS_PER_MEMBER = 25;

/** Distinct experiments a group plausibly feeds per bucket; member-independent. */
const EXPERIMENTS_PER_BUCKET = 25;

const BUCKET_MS = { hour: 3_600_000, day: 86_400_000 } as const;

/** Bucket count of the window, for sizing the grouped scans' row ceilings. */
function bucketsInWindow(window: MonitoringWindow): number {
  const span = new Date(window.to).getTime() - new Date(window.from).getTime();
  return Math.ceil(span / BUCKET_MS[window.bucket]) + 1;
}

/**
 * The group dashboard's one orchestrated read: live connectivity from the
 * fleet index, then last-data, per-member throughput, and lifecycle events
 * from the warehouse, each as ONE grouped scan over the member thing names.
 * Warehouse facts share one health flag: any of them failing sets
 * `pipelineUnavailable` and empties the affected facts, never the roster.
 */
@Injectable()
export class GetIotDeviceGroupMonitoringUseCase {
  private readonly logger = new Logger(GetIotDeviceGroupMonitoringUseCase.name);

  constructor(
    private readonly groupRepository: IotDeviceGroupRepository,
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    groupId: string,
    window: MonitoringWindow,
  ): Promise<Result<IotDeviceGroupMonitoringDto>> {
    const membersResult = await this.groupRepository.listMemberThings(groupId);
    if (membersResult.isFailure()) {
      return membersResult;
    }

    const members = membersResult.value;
    if (members.length === 0) {
      return success({
        members: [],
        throughput: [],
        dataByExperiment: [],
        firmware: [],
        events: [],
        pipelineUnavailable: false,
      });
    }

    const thingNames = members.map((member) => member.thingName);
    const deviceIdByThing = new Map(members.map((member) => [member.thingName, member.deviceId]));

    // One grouped scan per fact family, all in flight together: the dashboard's
    // latency is the slowest scan, not the sum.
    // Row ceilings derived from the window and roster keep one dashboard load
    // from returning an unbounded result set. Throughput's ceiling is exact
    // (one row per bucket and member); the experiment and firmware ceilings
    // are generous heuristics, so those lookups detect overflow and degrade
    // rather than ever report a truncated result as complete.
    const buckets = bucketsInWindow(window);
    const [connectivity, activity, throughput, dataByExperiment, firmware, events] =
      await Promise.all([
        this.lookupConnectivity(thingNames),
        this.lookupActivity(thingNames),
        this.lookupThroughput(thingNames, window, buckets * thingNames.length),
        this.lookupDataByExperiment(thingNames, window, buckets * EXPERIMENTS_PER_BUCKET),
        this.lookupFirmware(thingNames, window, FIRMWARE_VERSIONS_PER_MEMBER * thingNames.length),
        this.lookupEvents(thingNames, window),
      ]);

    const toDeviceId = (clientId: string | null) =>
      clientId === null ? null : (deviceIdByThing.get(clientId) ?? null);

    return success({
      members: members.map((member) => {
        const thing = connectivity?.get(member.thingName);
        return {
          deviceId: member.deviceId,
          name: member.name,
          serialNumber: member.serialNumber,
          deviceType: member.deviceType,
          connectivity: thing ? { connected: thing.connected, lastSeenAt: thing.lastSeenAt } : null,
          lastDataAt: activity?.get(member.thingName) ?? null,
        };
      }),
      throughput: (throughput ?? []).map((row) => ({
        bucketStart: row.bucketStart,
        deviceId: toDeviceId(row.clientId),
        count: row.count,
      })),
      dataByExperiment: dataByExperiment ?? [],
      firmware: this.latestFirmwarePerMember(firmware ?? []).map((row) => ({
        deviceId: toDeviceId(row.clientId),
        version: row.version,
        lastSeen: row.lastSeen,
      })),
      events: (events ?? []).map((row) => ({
        deviceId: toDeviceId(row.clientId),
        eventType: row.eventType,
        eventTimestamp: row.eventTimestamp,
        disconnectReason: row.disconnectReason,
      })),
      pipelineUnavailable:
        activity === null ||
        throughput === null ||
        dataByExperiment === null ||
        firmware === null ||
        events === null,
    });
  }

  private async lookupConnectivity(
    thingNames: string[],
  ): Promise<Map<string, ThingConnectivity> | null> {
    const result = await this.awsPort.searchThingsConnectivity(thingNames);
    if (result.isFailure()) {
      this.warn("Fleet-index connectivity lookup failed; members render as unknown", result);
      return null;
    }
    return result.value;
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
    window: MonitoringWindow,
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

  private async lookupDataByExperiment(
    thingNames: string[],
    window: MonitoringWindow,
    limit: number,
  ): Promise<GroupExperimentRow[] | null> {
    // One row past the ceiling: receiving it means the result is incomplete.
    const result = await this.databricksPort.getDevicesDataByExperiment(
      thingNames,
      window.from,
      window.to,
      window.bucket,
      limit + 1,
    );
    if (result.isFailure()) {
      this.warn("Warehouse data-by-experiment lookup failed", result);
      return null;
    }
    if (result.value.length > limit) {
      this.logger.warn({
        msg: "Data-by-experiment result exceeded its ceiling; degrading instead of truncating",
        operation: "getIotDeviceGroupMonitoring",
        limit,
      });
      return null;
    }
    return result.value;
  }

  private async lookupFirmware(
    thingNames: string[],
    window: MonitoringWindow,
    limit: number,
  ): Promise<GroupFirmwareRow[] | null> {
    // One row past the ceiling: receiving it means the result is incomplete,
    // and a truncated set could misstate a member's current version.
    const result = await this.databricksPort.getDevicesFirmware(
      thingNames,
      window.from,
      window.to,
      limit + 1,
    );
    if (result.isFailure()) {
      this.warn("Warehouse firmware lookup failed", result);
      return null;
    }
    if (result.value.length > limit) {
      this.logger.warn({
        msg: "Firmware result exceeded its ceiling; degrading instead of truncating",
        operation: "getIotDeviceGroupMonitoring",
        limit,
      });
      return null;
    }
    return result.value;
  }

  private async lookupEvents(
    thingNames: string[],
    window: MonitoringWindow,
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

  /** A member's current version is its most recently seen one in the window. */
  private latestFirmwarePerMember(rows: GroupFirmwareRow[]): GroupFirmwareRow[] {
    const latest = new Map<string, GroupFirmwareRow>();
    for (const row of rows) {
      if (row.clientId === null || row.lastSeen === null) continue;
      const current = latest.get(row.clientId);
      if (current?.lastSeen == null || row.lastSeen > current.lastSeen) {
        latest.set(row.clientId, row);
      }
    }
    return [...latest.values()];
  }

  private warn(msg: string, result: { error: { code: string } }) {
    this.logger.warn({
      msg,
      operation: "getIotDeviceGroupMonitoring",
      errorCode: result.error.code,
    });
  }
}
