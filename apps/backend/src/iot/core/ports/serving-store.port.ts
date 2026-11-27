import type { Result } from "../../../common/utils/fp-utils";
import type { DeviceReads } from "./device-reads.port";

export const IOT_SERVING_STORE_PORT = Symbol("IOT_SERVING_STORE_PORT");

/** A device's reads from the serving store, in the shapes warehouse reads come in. */
export interface ServingStorePort extends DeviceReads {
  /** False in an environment without a store, which reads from the warehouse instead. */
  isConfigured(): boolean;

  /**
   * Whether a reload has written device events. Only a reload brings the events from before their
   * feed began, so until then a device's sessions and uptime read empty, without an error.
   */
  hasDeviceEventsLoaded(): Promise<Result<boolean>>;
}
