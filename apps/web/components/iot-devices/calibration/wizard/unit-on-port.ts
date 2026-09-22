import { serialsMatch } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

interface RegisteredDevice {
  id: string;
  name: string | null;
  serialNumber: string;
  deviceType: string;
}

export type UnitOnPort =
  | { kind: "waiting" }
  | { kind: "unnamed" }
  | { kind: "unregistered"; serial: string }
  | { kind: "registered"; serial: string; device: RegisteredDevice };

export function unitOnPort(
  reportedSerial: string | undefined,
  family: CalibrationFamily,
  fleet: RegisteredDevice[] | undefined,
): UnitOnPort {
  if (reportedSerial === undefined || reportedSerial.trim() === "") {
    return reportedSerial === undefined ? { kind: "waiting" } : { kind: "unnamed" };
  }

  // Family as well as serial: two families could print the same identifier, and a
  // procedure is only ever run against the family it was written for.
  const device = (fleet ?? []).find(
    (candidate) =>
      candidate.deviceType === family && serialsMatch(reportedSerial, candidate.serialNumber),
  );

  return device === undefined
    ? { kind: "unregistered", serial: reportedSerial }
    : { kind: "registered", serial: reportedSerial, device };
}
