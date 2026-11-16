import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceReads } from "./device-reads.port";

/** Injection token for the IoT Databricks port */
export const IOT_DATABRICKS_PORT = Symbol("IOT_DATABRICKS_PORT");

/** One (bucket, device) measurement count for a group of things. */
export interface GroupThroughputRow {
  bucketStart: string | null;
  clientId: string | null;
  count: number;
}

/** One (bucket, experiment) measurement count aggregated across a group. */
export interface GroupExperimentRow {
  bucketStart: string | null;
  experimentId: string | null;
  count: number;
}

/** A (thing, firmware version) pair with its most recent sighting. */
export interface GroupFirmwareRow {
  clientId: string | null;
  version: string | null;
  lastSeen: string | null;
}

/** A broker lifecycle event carrying which thing it belongs to. */
export interface GroupLifecycleEventRow {
  clientId: string | null;
  eventType: string | null;
  eventTimestamp: string | null;
  disconnectReason: string | null;
}

/**
 * One (device, firmware) group as the gold device table aggregates it, scoped
 * to one experiment. A device that reported several firmware versions has one
 * row each, so callers fold by `clientId`.
 */
export interface ExperimentDeviceStatsRow {
  clientId: string | null;
  deviceName: string | null;
  firmware: string | null;
  version: string | null;
  battery: number | null;
  totalMeasurements: number;
  lastReportedAt: string | null;
}

/** One publisher's volume and last arrival inside one experiment's data. */
export interface ExperimentPublisherRow {
  clientId: string | null;
  count: number;
  lastDataAt: string | null;
}

/**
 * Every pipeline-computed fact about a device. Live connectivity is not
 * here; it comes from AWS directly.
 */
export interface DatabricksPort extends DeviceReads {
  getDevicesLastActivity(thingNames: string[]): Promise<Result<Map<string, string | null>>>;
  getDevicesThroughput(
    thingNames: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
    limit: number,
  ): Promise<Result<GroupThroughputRow[]>>;
  getDevicesLifecycleEvents(
    thingNames: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<GroupLifecycleEventRow[]>>;
  getDevicesDataByExperiment(
    thingNames: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
    limit: number,
  ): Promise<Result<GroupExperimentRow[]>>;
  getDevicesFirmware(
    thingNames: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<GroupFirmwareRow[]>>;
  getExperimentPublishers(
    experimentId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<ExperimentPublisherRow[]>>;
  getExperimentDeviceStats(
    experimentId: string,
    limit: number,
  ): Promise<Result<ExperimentDeviceStatsRow[]>>;
}
