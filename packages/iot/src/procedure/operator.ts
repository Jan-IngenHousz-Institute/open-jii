import type { CaptureResult } from "./types";

/**
 * How a procedure reaches the person at the bench.
 *
 * The interpreter never draws anything: a step that needs a fixture moved, a
 * lamp turned by hand, or a meter reading typed in goes through this port, and
 * the wizard, a mobile screen, or a test double supplies it.
 */

/**
 * Raised when a procedure stops before completing, carrying everything it did
 * capture. A bench session is long and its series are independent, so a rig
 * fault twenty minutes in must not discard the sweeps that already succeeded:
 * the operator can submit what completed, or retry only the rest.
 */
export class ProcedureAborted extends Error {
  constructor(
    /** What actually went wrong: a declined step, a rig fault, a dead read. */
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
  /**
   * Show an instruction and wait. When `confirm` is set the operator must type
   * that exact token, which is how a procedure gates a step that is unsafe or
   * meaningless to perform unprepared. Returning false declines the step.
   */
  acknowledge(prompt: string, confirm?: string): Promise<boolean>;

  /** Ask for a value the rig cannot measure, such as a handheld meter reading. */
  readValue(prompt: string, type: "number" | "text"): Promise<number | string>;
}

/** Progress a wizard renders while a procedure runs. */
export type ProcedureProgress =
  | { kind: "step"; index: number; total: number; description: string }
  | { kind: "setpoint"; series: string; index: number; total: number; value: unknown }
  | { kind: "series"; series: string; rows: number }
  | { kind: "skipped"; series: string; reason: string };
