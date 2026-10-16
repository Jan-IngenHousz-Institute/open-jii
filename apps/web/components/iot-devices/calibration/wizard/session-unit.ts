/** One unit's turn on the bench. A batch is measured first and decided at review. */
export interface SessionUnit {
  serial: string;
  deviceId: string | null;
  deviceName: string | null;
  runId: string;
  outcome: "recorded" | "failed";
  reason?: string;
}

/** By device, not by serial: a unit the operator names by hand has no serial of its own to match. */
export function unitAlreadyDone(units: SessionUnit[], deviceId: string): SessionUnit | undefined {
  return units.find((unit) => unit.deviceId === deviceId);
}
