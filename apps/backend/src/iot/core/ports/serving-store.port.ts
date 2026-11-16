import type { DeviceReads } from "./device-reads.port";

export const IOT_SERVING_STORE_PORT = Symbol("IOT_SERVING_STORE_PORT");

/** A device page's reads from the serving store, in the shapes warehouse reads come in. */
export interface ServingStorePort extends DeviceReads {
  /** False in an environment without a store, which reads from the warehouse instead. */
  isConfigured(): boolean;
}
