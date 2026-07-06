// Environment-agnostic workbook execution runtime. Hosts (web, mobile, demos)
// construct a WorkbookRunner with their macro-runner and command-executor
// implementations; the pure `transition` core owns all run semantics.

export type { CommandCellLike, CommandFormat, RunnerCell } from "./cells";
export { isCommandCell } from "./cells";

export type { CellNamespace } from "./namespace/build-cell-namespace";

export type {
  ClockPort,
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
  CommandSource,
  LoggerPort,
  MacroLanguage,
  MacroRunInput,
  MacroRunnerPort,
  OutputStorePort,
  ProtocolCodeResolverPort,
  ResolvedCommandValue,
} from "./ports";
export { noopLogger, systemClock } from "./ports";

export type {
  BranchReturnEntry,
  CellRunState,
  CellRunStatus,
  EnteredVia,
  InFlightEffect,
  RunnerMode,
  RunnerPosition,
  RunnerState,
  RunnerStatus,
} from "./runner/state";
export { createInitialState, MAX_BRANCH_VISITS } from "./runner/state";

export type {
  EffectTimings,
  WorkbookEvent,
  WorkbookInternalEvent,
  WorkbookPublicEvent,
} from "./runner/events";
export type { Effect, TransitionResult } from "./runner/effects";
export { transition } from "./runner/reducer";
export { ownerCellId } from "./runner/cell-entry";
export { isProducer } from "./flow/flow-utils";

export type { SnapshotOutputEntry, WorkbookSnapshot } from "./runner/snapshot";
export { hashCells, parseSnapshot, SnapshotError } from "./runner/snapshot";

export type { WorkbookRunnerOptions, WorkbookRunnerPorts } from "./runner/workbook-runner";
export { WorkbookRunner } from "./runner/workbook-runner";
