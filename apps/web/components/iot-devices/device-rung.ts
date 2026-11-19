import { deviceRung as resolveDeviceRung } from "@repo/api/domains/iot/device-rung";
import type { IotDeviceRung, IotDeviceStatus } from "@repo/api/domains/iot/iot.schema";

/** The stored status resolved against the binding count: "active" reads as Provisioned or Onboarded. */
export function deviceRung(status: IotDeviceStatus, boundExperimentCount: number): IotDeviceRung {
  return resolveDeviceRung(status, boundExperimentCount);
}
