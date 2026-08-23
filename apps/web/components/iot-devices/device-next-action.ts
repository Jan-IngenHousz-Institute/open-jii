import type { IotDevice } from "@repo/api/domains/iot/iot.schema";

/**
 * The one next step a device's setup is waiting on, or null when it is fully
 * set up. Computed purely from data every surface already holds; there is no
 * stored lifecycle state to drift out of sync.
 *
 * Phones self-register and pick their experiment in the app, so no step ever
 * applies to them.
 */
export type DeviceNextAction = "issueCredentials" | "onboard" | null;

export function deviceNextAction(
  device: Pick<IotDevice, "status" | "deviceType">,
  boundExperimentCount: number,
): DeviceNextAction {
  if (device.deviceType === "mobile") {
    return null;
  }
  if (device.status === "pending" || device.status === "revoked") {
    return "issueCredentials";
  }
  if (boundExperimentCount === 0) {
    return "onboard";
  }
  return null;
}
