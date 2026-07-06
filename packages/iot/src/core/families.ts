/**
 * Sensor families the platform recognises. Kept in sync by hand with
 * `zSensorFamily` in @repo/api (schemas/protocol.schema.ts) and the
 * `sensor_family` pg enum in @repo/database. @repo/iot stays dependency-free,
 * so the list is duplicated rather than imported.
 */
export const SENSOR_FAMILIES = ["multispeq", "ambit", "generic"] as const;

export type SensorFamily = (typeof SENSOR_FAMILIES)[number];

export function isSensorFamily(value: unknown): value is SensorFamily {
  return typeof value === "string" && (SENSOR_FAMILIES as readonly string[]).includes(value);
}

export interface DeviceIdentity {
  family: SensorFamily;
  name?: string;
  deviceId?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
  /** Raw probe / device_info payload for display and debugging. */
  raw: Record<string, unknown>;
}
