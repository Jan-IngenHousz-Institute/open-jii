/**
 * The capture procedure as this package executes it: a structural mirror of the
 * contract's zCaptureProcedure, since this package has no dependencies. Shared fixtures guard the two.
 */

export const DUT_ROLE = "dut";

/** Reserved column carrying the setpoint on every sweep row. */
export const SWEEP_STIMULUS_COLUMN = "stimulus";

export interface RigInstrument {
  role: string;
  /** Substring the instrument's identity reply must contain. Absent for the dut. */
  handshake?: string;
}

/** A sweep setpoint: a scalar, a label, or a compound of several axes. */
export type SetpointValue = number | string | Record<string, number | string>;

/** An instrument takes numbers; labels and compound setpoints are for the operator. */
export interface InstrumentStimulus {
  instrument: string;
  set: string;
  values: number[];
}

export interface OperatorStimulus {
  /** Prompt shown per setpoint; `{value}` interpolates it. */
  operator: string;
  values: SetpointValue[];
}

export type Stimulus = InstrumentStimulus | OperatorStimulus;

export interface InstrumentRead {
  instrument: string;
  command?: string;
  protocol?: string;
  as: string;
  /** Samples to take at this point; more than one yields an array. */
  repeat?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

export interface OperatorRead {
  operator: string;
  as: string;
  type: "number" | "text";
}

export type ProcedureRead = InstrumentRead | OperatorRead;

export interface OperatorStep {
  kind: "operator";
  prompt: string;
  /** Token the operator must type for the run to continue. */
  confirm?: string;
}

export interface SettleStep {
  kind: "settle";
  ms: number;
}

export interface ReadStep {
  kind: "read";
  series: string;
  prompt?: string;
  read: ProcedureRead[];
  optional?: boolean;
}

export interface SweepStep {
  kind: "sweep";
  series: string;
  stimulus: Stimulus;
  settleMs?: number;
  read: ProcedureRead[];
  optional?: boolean;
}

export type ProcedureStep = OperatorStep | SettleStep | ReadStep | SweepStep;

export type MeasurementProtocol = Record<string, unknown>;

export interface CaptureProcedure {
  instruments: RigInstrument[];
  /** Declared once by name; an instrument read refers to one by that name. */
  protocols?: Partial<Record<string, MeasurementProtocol>>;
  steps: ProcedureStep[];
}

/** One captured value. Matches the contract's series cell union. */
export type SeriesCell = number | string | boolean | number[] | Record<string, number | string>;

export type SeriesRow = Record<string, SeriesCell | null>;

export type CapturePayload = Record<string, SeriesRow[]>;

export interface SkippedSeries {
  series: string;
  reason: string;
}

export interface CaptureResult {
  payload: CapturePayload;
  /** Optional steps that did not run, and why, for the run record. */
  skipped: SkippedSeries[];
}

export function isInstrumentStimulus(stimulus: Stimulus): stimulus is InstrumentStimulus {
  return "instrument" in stimulus;
}

export function isInstrumentRead(read: ProcedureRead): read is InstrumentRead {
  return "instrument" in read;
}

export function requiredSeriesNames(procedure: CaptureProcedure): string[] {
  return procedure.steps
    .filter(
      (step): step is ReadStep | SweepStep =>
        (step.kind === "read" || step.kind === "sweep") && !step.optional,
    )
    .map((step) => step.series);
}
