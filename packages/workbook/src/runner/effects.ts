import type { CommandRunInput } from "../ports/command-executor";
import type { MacroRunInput } from "../ports/macro-runner";

export type Effect =
  | { kind: "runMacro"; effectId: string; cellId: string; input: MacroRunInput }
  | { kind: "runCommand"; effectId: string; cellId: string; input: CommandRunInput }
  | {
      kind: "resolveProtocolCode";
      effectId: string;
      cellId: string;
      protocolId: string;
      version: number;
    }
  | { kind: "cancelEffects"; effectIds: string[] };

export interface TransitionResult {
  state: import("./state").RunnerState;
  effects: Effect[];
}
