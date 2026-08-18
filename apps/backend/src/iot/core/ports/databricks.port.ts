import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceLifecycleEventRow } from "../models/device-lifecycle-event.model";

/** Injection token for the IoT Databricks port */
export const IOT_DATABRICKS_PORT = Symbol("IOT_DATABRICKS_PORT");

/** One (bucket, device) measurement count for a group of things. */
export interface GroupThroughputRow {
  bucketStart: string | null;
  clientId: string | null;
  count: number;
}

/** A broker lifecycle event carrying which thing it belongs to. */
export interface GroupLifecycleEventRow {
  clientId: string | null;
  eventType: string | null;
  eventTimestamp: string | null;
  disconnectReason: string | null;
}

/** One time bucket of measurement volume, attributed to an experiment. */
export interface DeviceThroughputRow {
  bucketStart: string | null;
  experimentId: string | null;
  count: number;
}

/** Average reported battery for one time bucket; null when none was reported. */
export interface DeviceBatteryRow {
  bucketStart: string | null;
  averageBattery: number | null;
}

/** Measurement counts and metadata coverage per payload-shape combination. */
export interface DevicePayloadBreakdownRow {
  deviceVersion: string | null;
  protocolId: string | null;
  workbookVersionId: string | null;
  workbookRunId: string | null;
  count: number;
  withGps: number;
  withBattery: number;
}

/** Measurement count per macro; a measurement can carry several macros. */
export interface DeviceMacroRow {
  macroId: string | null;
  count: number;
}

/** One (time bucket, version) group; a version reappears in later buckets. */
export interface DeviceFirmwareVersionRow {
  version: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  count: number;
}

/** One measurement as stored, for the row-level view behind the aggregates. */
export interface DeviceMeasurementRow {
  timestamp: string | null;
  experimentId: string | null;
  protocolId: string | null;
  workbookVersionId: string | null;
  deviceVersion: string | null;
  battery: number | null;
  latitude: number | null;
  longitude: number | null;
  sample: string | null;
}

/**
 * Every pipeline-computed fact about a device. Live connectivity is not
 * here; it comes from AWS directly.
 */
export interface DatabricksPort {
  getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>>;
  getDevicesLastActivity(thingNames: string[]): Promise<Result<Map<string, string | null>>>;
  getDevicesThroughput(
    thingNames: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<GroupThroughputRow[]>>;
  getDevicesLifecycleEvents(
    thingNames: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<GroupLifecycleEventRow[]>>;
  getDeviceLifecycleEvents(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceLifecycleEventRow[]>>;
  getDeviceThroughput(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceThroughputRow[]>>;
  getDeviceBatterySeries(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceBatteryRow[]>>;
  getDevicePayloadBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DevicePayloadBreakdownRow[]>>;
  getDeviceMacroBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DeviceMacroRow[]>>;
  getDeviceFirmwareHistory(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceFirmwareVersionRow[]>>;
  getDeviceRecentMeasurements(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceMeasurementRow[]>>;
}
