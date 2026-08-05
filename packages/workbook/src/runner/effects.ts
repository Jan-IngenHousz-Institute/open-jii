import type { CommandRunInput, DeviceOutcome, MacroRunInput } from "../ports";
import type { RunnerState } from "./state";

/**
 * One device leg of a macro effect, in upstream device order: either a run to
 * execute, or a device whose upstream measurement already failed and whose
 * error is carried through without running the macro.
 */
export type MacroLeg =
  | { kind: "run"; input: MacroRunInput }
  | { kind: "carriedFailure"; outcome: DeviceOutcome };

export type Effect =
  | {
      kind: "runMacro";
      effectId: string;
      trackId: string;
      cellId: string;
      /** A plain single-device run is one "run" leg without a deviceId. */
      legs: MacroLeg[];
    }
  | {
      kind: "runCommand";
      effectId: string;
      trackId: string;
      cellId: string;
      input: CommandRunInput;
    }
  | {
      kind: "resolveProtocolCode";
      effectId: string;
      trackId: string;
      cellId: string;
      protocolId: string;
      version: number;
    }
  | { kind: "cancelEffects"; effectIds: string[] };

export interface TransitionResult {
  state: RunnerState;
  effects: Effect[];
}
