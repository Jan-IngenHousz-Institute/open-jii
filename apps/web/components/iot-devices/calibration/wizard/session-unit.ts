/** One unit's turn on the bench. A batch is measured first and decided at review. */
export interface SessionUnit {
  serial: string;
  deviceId: string | null;
  deviceName: string | null;
  runId: string;
  outcome: "recorded" | "failed";
  reason?: string;
}

export function unitAlreadyDone(units: SessionUnit[], serial: string): SessionUnit | undefined {
  return units.find((unit) => unit.serial === serial);
}
