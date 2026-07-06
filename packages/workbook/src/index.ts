// Environment-agnostic workbook execution runtime. Hosts (web, mobile, demos)
// construct a WorkbookRunner with their macro-runner and command-executor
// implementations; the pure `transition` core owns all run semantics.

export type { CommandCellLike, CommandFormat, RunnerCell } from "./cells";
export { isCommandCell } from "./cells";

export type { CellNamespace } from "./namespace/build-cell-namespace";
export { buildCellNamespace, resolveOutputData } from "./namespace/build-cell-namespace";

export type {
  ArtifactFamily,
  CommandArtifact,
  MacroArtifact,
  ProtocolArtifact,
} from "./artifact/macro-artifact";
export {
  parseMacroArtifact,
  zCommandArtifact,
  zMacroArtifact,
  zProtocolArtifact,
} from "./artifact/macro-artifact";

export type { InlineCommand, ResolvedCommand } from "./command/command-payload";
export { resolveInlineCommand, validateInlineCommand } from "./command/command-payload";

export {
  dispatchStepId,
  DISPATCH_STEP_SUFFIX,
  executableCells,
  firstExecutableCellId,
  isExecutable,
  isProducer,
  nearestUpstreamProducerId,
  nextCellId,
  prevCellId,
} from "./flow/flow-utils";
export { hydrateCells } from "./flow/hydrate";
export type { OutputEntry } from "./flow/hydrate";
export { normalizeOutputData } from "./flow/normalize-output";

export type { ClockPort } from "./ports/clock";
export { systemClock } from "./ports/clock";
export type { LoggerPort } from "./ports/logger";
export { noopLogger } from "./ports/logger";
export type { MacroLanguage, MacroRunInput, MacroRunnerPort } from "./ports/macro-runner";
export type {
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
  CommandSource,
  ResolvedCommandValue,
} from "./ports/command-executor";
export type { ProtocolCodeResolverPort } from "./ports/protocol-code-resolver";
export type { OutputStorePort } from "./ports/output-store";

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
export { createInitialState, currentAnswers, MAX_BRANCH_VISITS } from "./runner/state";

export type {
  EffectTimings,
  WorkbookEvent,
  WorkbookInternalEvent,
  WorkbookPublicEvent,
} from "./runner/events";
export type { Effect, TransitionResult } from "./runner/effects";
export { transition } from "./runner/reducer";
export { markDownstreamStale, ownerCellId } from "./runner/cell-entry";

export type { SnapshotOutputEntry, WorkbookSnapshot } from "./runner/snapshot";
export { hashCells, parseSnapshot, SnapshotError, zWorkbookSnapshot } from "./runner/snapshot";

export {
  getAnswers,
  getCurrentCell,
  getMatchedPathId,
  getOutputRaw,
  getOutputView,
  getProgress,
  isCellStale,
  isDone,
  materializeCells,
} from "./runner/selectors";

export type { WorkbookRunnerOptions, WorkbookRunnerPorts } from "./runner/workbook-runner";
export { WorkbookRunner } from "./runner/workbook-runner";
