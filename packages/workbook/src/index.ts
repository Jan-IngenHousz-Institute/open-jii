// Environment-agnostic workbook execution runtime. Hosts (web, mobile, demos)
// construct a WorkbookRunner with their macro-runner and command-executor
// implementations; the pure `transition` core owns all run semantics.

export type { CommandFormat, RunnerCell } from "./cells";
export { isCommandCell } from "./cells";

export type { CellNamespace } from "@repo/api/transforms/build-cell-namespace";

export type {
  ClockPort,
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
  CommandSource,
  DeviceOutcome,
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
  DeviceRef,
  DispatchRun,
  EnteredVia,
  InFlightEffect,
  RunnerMode,
  RunnerPosition,
  RunnerState,
  RunnerStatus,
} from "./runner/state";
export { createInitialState, MAX_BRANCH_VISITS } from "./runner/state";

export type { OutputEntry } from "./flow/hydrate";
export { hydrateCells } from "./flow/hydrate";
export type { CollapsedOutcomes } from "./runner/fan-out";
export { collapseOutcomes } from "./runner/fan-out";

export type {
  EffectTimings,
  WorkbookEvent,
  WorkbookInternalEvent,
  WorkbookPublicEvent,
} from "./runner/events";
export type { Effect, MacroLeg, TransitionResult } from "./runner/effects";
export { transition } from "./runner/reducer";
export { lastOrder, ownerCellId } from "./runner/cell-entry";
export { isProducer } from "./flow/flow-utils";

export type { CellViewRun } from "./runner/host-view";
export { carryOverState, effectiveCellRuns } from "./runner/host-view";
export { mergeCellsView, outputsFromCells } from "./runner/host-view";

export type { SnapshotOutputEntry, WorkbookSnapshot } from "./runner/snapshot";
export { hashCells, parseSnapshot, SnapshotError } from "./runner/snapshot";

export type { WorkbookRunnerOptions, WorkbookRunnerPorts } from "./runner/workbook-runner";
export { WorkbookRunner } from "./runner/workbook-runner";
