import type { CommandProgress } from "../ports";

export type WorkbookPublicEvent =
  | { type: "START" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "ANSWER"; cellId: string; value: string }
  | { type: "RUN_CELL"; cellId: string }
  | { type: "RUN_ALL" }
  /** End the active pass between cells (graceful). */
  | { type: "STOP" }
  /** Abort the in-flight effect now. */
  | { type: "CANCEL" }
  | { type: "RETRY" }
  /** Explicit new iteration: cycle wrap + outputs cleared (mobile parity). */
  | { type: "START_CYCLE" }
  | { type: "CLEAR_OUTPUTS" }
  | { type: "RESET" };

export interface EffectTimings {
  startedAt: number;
  endedAt: number;
}

/** Driver-fed completions; every one is gated on effectId matching inFlight. */
export type WorkbookInternalEvent =
  | {
      type: "MACRO_DONE";
      effectId: string;
      cellId: string;
      output: Record<string, unknown>;
      timings: EffectTimings;
    }
  | {
      type: "MACRO_FAILED";
      effectId: string;
      cellId: string;
      error: string;
      timings: EffectTimings;
    }
  | {
      type: "COMMAND_DONE";
      effectId: string;
      cellId: string;
      output: unknown;
      timings: EffectTimings;
    }
  | {
      type: "COMMAND_FAILED";
      effectId: string;
      cellId: string;
      error: string;
      timings: EffectTimings;
    }
  | { type: "COMMAND_PROGRESS"; effectId: string; cellId: string; progress: CommandProgress }
  | {
      type: "CODE_RESOLVED";
      effectId: string;
      cellId: string;
      code: Record<string, unknown>[] | null;
      timings: EffectTimings;
    }
  | {
      type: "CODE_RESOLVE_FAILED";
      effectId: string;
      cellId: string;
      error: string;
      timings: EffectTimings;
    }
  | { type: "EFFECT_CANCELLED"; effectId: string; cellId: string };

export type WorkbookEvent = WorkbookPublicEvent | WorkbookInternalEvent;

/** Internal events are exactly the ones carrying an effect id. */
export function isInternalEvent(event: WorkbookEvent): event is WorkbookInternalEvent {
  return "effectId" in event;
}
