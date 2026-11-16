import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceLifecycleEventRow } from "../models/device-lifecycle-event.model";

/** One time bucket of one device's measurement volume inside one experiment. */
export interface ExperimentDeviceSeriesRow {
  bucketStart: string | null;
  count: number;
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

/** A device's reads, which the warehouse and the serving store both answer. */
export interface DeviceReads {
  getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>>;
  getExperimentDeviceSeries(
    experimentId: string,
    clientId: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<ExperimentDeviceSeriesRow[]>>;
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
