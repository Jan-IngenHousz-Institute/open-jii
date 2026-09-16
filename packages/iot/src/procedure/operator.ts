import type { CaptureResult, SeriesCell, SeriesRow } from "./types";

/** How a procedure reaches the person at the bench; the interpreter never draws anything. */

/**
 * Raised when a procedure stops early, carrying everything it captured: a rig fault
 * twenty minutes in must not discard the sweeps that already succeeded.
 */
export class ProcedureAborted extends Error {
  constructor(
    readonly reason: Error,
    readonly partial: CaptureResult,
  ) {
    super(`Procedure aborted: ${reason.message}`);
    this.name = "ProcedureAborted";
  }
}

/** Raised when the operator declines a gated step. */
export class ProcedureDeclined extends Error {
  constructor(readonly prompt: string) {
    super(`Operator declined: ${prompt}`);
    this.name = "ProcedureDeclined";
  }
}

/** Raised when a rig cannot satisfy a step the procedure requires. */
export class ProcedureRigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcedureRigError";
  }
}

export interface OperatorPort {
  /** When `confirm` is set the operator must type that exact token; returning false declines the step. */
  acknowledge(prompt: string, confirm?: string): Promise<boolean>;

  /** Ask for a value the rig cannot measure, such as a handheld meter reading. */
  readValue(prompt: string, type: "number" | "text"): Promise<number | string>;

  /**
   * Offer a reading the operator just produced by hand. Returning false takes the point
   * again, which is what someone at a manual bench does when a filter slipped or the
   * reference had not settled. Only points the operator drives are offered: nobody is
   * standing over an automated sweep.
   */
  confirmReading(reading: OperatorReading): Promise<boolean>;
}

/** One captured point, offered back to the operator who produced it. */
export interface OperatorReading {
  series: string;
  /** The setpoint this point was taken at; a read step outside a sweep has none. */
  stimulus: SeriesCell | undefined;
  row: SeriesRow;
}

/** Progress a wizard renders while a procedure runs. */
export type ProcedureProgress =
  | { kind: "step"; index: number; total: number; description: string }
  | { kind: "setpoint"; series: string; index: number; total: number; value: unknown }
  | { kind: "series"; series: string; rows: number }
  | { kind: "skipped"; series: string; reason: string }
  | { kind: "retake"; series: string; index: number; attempt: number };
