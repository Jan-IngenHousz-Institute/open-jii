import type { IotDeviceRung, IotDeviceStatus } from "./iot.schema";

export function deviceRung(status: IotDeviceStatus, boundExperimentCount: number): IotDeviceRung {
  if (status === "active") {
    return boundExperimentCount > 0 ? "onboarded" : "provisioned";
  }
  return status;
}
