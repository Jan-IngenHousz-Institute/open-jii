/**
 * Which registered device the unit on the port is, worked out from what it announced.
 *
 * The bench is handed hardware and finds out what it is, rather than being told beforehand
 * and hoping. The fleet is already loaded for the devices overview, so the answer is a
 * comparison rather than a request.
 */
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
  /** It answered, but with nothing that names it, so the fleet cannot be searched. */
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
