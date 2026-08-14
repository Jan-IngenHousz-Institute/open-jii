import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceLifecycleEventRow } from "../models/device-lifecycle-event.model";

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
  ): Promise<Result<DeviceLifecycleEventRow[]>>;
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
  getDevicePayloadBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<
    Result<
      {
        deviceVersion: string | null;
        protocolId: string | null;
        workbookRunId: string | null;
        count: number;
        withGps: number;
        withBattery: number;
      }[]
    >
  >;
}
