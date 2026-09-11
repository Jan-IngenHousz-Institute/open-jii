import type { CaptureResult } from "./types";

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
}

/** Progress a wizard renders while a procedure runs. */
export type ProcedureProgress =
  | { kind: "step"; index: number; total: number; description: string }
  | { kind: "setpoint"; series: string; index: number; total: number; value: unknown }
  | { kind: "series"; series: string; rows: number }
  | { kind: "skipped"; series: string; reason: string };
