/**
 * The connected device as a workbook runtime value: branch conditions read it
 * via the reserved `$device` source and macros will read it as `ctx["$device"]`.
 * The `$` prefix is collision-proof because `sanitizeQuestionLabel` can never
 * emit it into a cell name. Fields are structural strings; @repo/api must not
 * import @repo/iot (its `DeviceIdentity` maps onto this shape by hand).
 */
export const DEVICE_CONTEXT_KEY = "$device";

export const DEVICE_CONTEXT_FIELDS = ["family", "id", "name", "index", "firmwareVersion"] as const;

export type DeviceContextField = (typeof DEVICE_CONTEXT_FIELDS)[number];

export interface DeviceContext {
  family: string;
  id?: string;
  name?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
  /** Position of the device in the host's connection list (0-based). */
  index: number;
}

/** Shape-compatible subset of @repo/iot's DeviceIdentity (raw is dropped). */
interface DeviceIdentityLike {
  family: string;
  name?: string;
  deviceId?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
}

export function toDeviceContext(identity: DeviceIdentityLike, index: number): DeviceContext {
  return {
    family: identity.family,
    id: identity.deviceId,
    name: identity.name,
    firmwareVersion: identity.firmwareVersion,
    batteryPercent: identity.batteryPercent,
    index,
  };
}
