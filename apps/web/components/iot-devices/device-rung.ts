import type { IotDeviceRung, IotDeviceStatus } from "@repo/api/domains/iot/iot.schema";

/** The stored status resolved against the binding count: "active" reads as Provisioned or Onboarded. */
export function deviceRung(status: IotDeviceStatus, boundExperimentCount: number): IotDeviceRung {
  if (status === "active") {
    return boundExperimentCount > 0 ? "onboarded" : "provisioned";
  }
  return status;
}
