import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceLifecycleEventRow } from "../models/device-lifecycle-event.model";

/**
 * Injection token for the IoT Databricks port
 */
export const IOT_DATABRICKS_PORT = Symbol("IOT_DATABRICKS_PORT");

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
 * Port interface for Databricks operations in the IoT domain: every
 * pipeline-computed fact about a device, namely last data arrival, lifecycle
 * events, measurement throughput, battery series and payload breakdown. Live
 * connectivity is not here; it comes from AWS directly.
 */
export interface DatabricksPort {
  getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>>;
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
  getDeviceRecentMeasurements(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceMeasurementRow[]>>;
}
