/**
 * One unit's turn on the bench, as the sitting remembers it.
 *
 * A batch is measured first and decided afterwards, so what a finished turn leaves behind
 * is a recorded run rather than a verdict. The verdict arrives at review, and the write
 * arrives after that, whenever the unit is next on a port.
 */
export interface SessionUnit {
  /** What the unit answered when asked who it is; the identity the whole sitting keys on. */
  serial: string;
  /** The registered device this unit is, where the fleet holds one. */
  deviceId: string | null;
  deviceName: string | null;
  runId: string;
  /** Recorded, or refused with a reason the operator can act on at the bench. */
  outcome: "recorded" | "failed";
  reason?: string;
}

/** Whether this unit has already had its turn, which is the batch's commonest mistake. */
export function unitAlreadyDone(units: SessionUnit[], serial: string): SessionUnit | undefined {
  return units.find((unit) => unit.serial === serial);
}
