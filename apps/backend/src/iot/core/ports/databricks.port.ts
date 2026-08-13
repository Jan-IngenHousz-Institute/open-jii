import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the IoT Databricks port
 */
export const IOT_DATABRICKS_PORT = Symbol("IOT_DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the IoT domain. The warehouse is
 * only consulted for pipeline-computed facts (last data arrival); live
 * connectivity comes from AWS directly.
 */
export interface DatabricksPort {
  getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>>;
  getDeviceLifecycleEvents(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<
    Result<
      {
        eventType: string | null;
        eventTimestamp: string | null;
        disconnectReason: string | null;
        sessionIdentifier: string | null;
      }[]
    >
  >;
  getDeviceThroughput(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<{ bucketStart: string | null; experimentId: string | null; count: number }[]>>;
  getDeviceBatterySeries(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<{ bucketStart: string | null; averageBattery: number | null }[]>>;
  getDevicePayloadCoverage(
    thingName: string,
    from: string,
    to: string,
  ): Promise<
    Result<{ total: number; withGps: number; withBattery: number; withWorkbookRun: number }[]>
  >;
  getDevicePayloadMix(
    thingName: string,
    from: string,
    to: string,
    column: "device_version" | "protocol_id" | "workbook_run_id",
  ): Promise<Result<{ value: string | null; count: number }[]>>;
}
