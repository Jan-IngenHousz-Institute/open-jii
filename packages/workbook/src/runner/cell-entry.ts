import type { BranchCell, ParallelCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import {
  buildCellNamespace,
  isOutputDataNormalizationError,
} from "@repo/api/transforms/build-cell-namespace";
import { validateInlineCommand } from "@repo/api/transforms/command-payload";
import type { DeviceContext } from "@repo/api/transforms/device-context";
import { toDeviceContext } from "@repo/api/transforms/device-context";
import {
  evaluateBranch,
  assignParallelLanes,
  isDeviceScopedBranch,
  validateBranchCell,
  validateDeviceBranch,
} from "@repo/api/transforms/evaluate-branch";
import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";
import { findWorkbookCell, workbookBodyAtPath } from "@repo/api/transforms/workbook-cell-tree";
import { validateCommandArtifact } from "@repo/iot";
import type { SensorFamily } from "@repo/iot";

import type { MacroArtifact } from "../artifact/macro-artifact";
import { isCommandCell } from "../cells";
import {
  cellById,
  cellIndex,
  DISPATCH_STEP_SUFFIX,
  dispatchStepId,
  firstExecutableCellId,
  isProducer,
  nearestUpstreamProducerId,
  nextCellId,
  prevCellId,
  resolveGotoCellId,
} from "../flow/flow-utils";
import { asWorkbookCells, hydrateCells } from "../flow/hydrate";
import type { CommandSource, ResolvedCommandValue } from "../ports";
import type { Effect, MacroLeg, TransitionResult } from "./effects";
import type {
  CellRunState,
  CellPath,
  DeviceRef,
  EffectPhase,
  EnteredVia,
  ParallelContainerAttempt,
  ParallelContextEntry,
  ParallelLaneAttempt,
  ParallelLaneDeviceOutcome,
  ParallelLaneTerminalStatus,
  RunnerState,
  Track,
} from "./state";
import { currentAnswers, getTrack, MAIN_TRACK_ID, setTrack, spawnTracks, trace } from "./state";

export function setCellRun(state: RunnerState, cellId: string, run: CellRunState): RunnerState {
  return { ...state, cellRuns: { ...state.cellRuns, [cellId]: run } };
}

/** Unaccepted events are no-ops that only leave a trace line. */
export function ignored(state: RunnerState, what: string): TransitionResult {
  return { state: trace(state, `ignored ${what} in ${state.status}`), effects: [] };
}

export function lastOrder(run: CellRunState | undefined): number {
  return run?.executionOrder[run.executionOrder.length - 1] ?? 0;
}

export function stackTop<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/** Start a run: assign the next Jupyter counter and mark the cell running. */
export function stampRun(state: RunnerState, cellId: string): RunnerState {
  const execCounter = state.execCounter + 1;
  const prev = state.cellRuns[cellId];
  return {
    ...setCellRun({ ...state, execCounter }, cellId, {
      status: "running",
      executionOrder: [...(prev?.executionOrder ?? []), execCounter],
    }),
  };
}

export function isAtStart(state: RunnerState, trackId: string, cellId: string): boolean {
  const track = getTrack(state, trackId);
  return (
    prevCellId(state.cells, cellId, track.cursor.body) === null && track.returnStack.length === 0
  );
}

function nextTrackCellId(state: RunnerState, trackId: string, cellId: string): string | null {
  return nextCellId(state.cells, cellId, getTrack(state, trackId).cursor.body);
}

function previousTrackCellId(state: RunnerState, trackId: string, cellId: string): string | null {
  return prevCellId(state.cells, cellId, getTrack(state, trackId).cursor.body);
}

/** The flow cell a synthetic dispatch step belongs to (identity otherwise). */
export function ownerCellId(effectCellId: string): string {
  return effectCellId.endsWith(DISPATCH_STEP_SUFFIX)
    ? effectCellId.slice(0, -DISPATCH_STEP_SUFFIX.length)
    : effectCellId;
}

export function completeRun(
  state: RunnerState,
  cellId: string,
  executionTimeMs?: number,
): RunnerState {
  const prev = state.cellRuns[cellId];
  return setCellRun(state, cellId, {
    status: "completed",
    executionOrder: prev?.executionOrder ?? [],
    executionTimeMs,
    lastMatchedPathId: prev?.lastMatchedPathId,
  });
}

/**
 * Downstream stale marking, web's model: after `originCellId` completes a run,
 * every producer later in document order whose last completed run predates the
 * origin's latest stamp goes stale. Outputs are kept; stale only re-arms the
 * cell. Branch/markdown/output/question cells never go stale. Document order
 * over-marks safely; a reference-based policy can replace this function later.
 */
export function markDownstreamStale(
  state: RunnerState,
  originCellId: string,
  originStamp: number = lastOrder(state.cellRuns[originCellId]),
): RunnerState {
  if (originStamp === 0) return state;
  const location = findWorkbookCell(state.cells, originCellId);
  if (!location) return state;

  let cellRuns = state.cellRuns;
  for (let i = location.index + 1; i < location.body.length; i++) {
    const cell = location.body[i];
    if (!isProducer(cell)) continue;
    const run = cellRuns[cell.id];
    if (run?.status === "completed" && lastOrder(run) < originStamp) {
      cellRuns = { ...cellRuns, [cell.id]: { ...run, status: "stale" } };
    }
  }
  return cellRuns === state.cellRuns ? state : { ...state, cellRuns };
}

/** Mint the next effect id, set inFlight, and emit the effect built from it. */
function emitEffect(
  state: RunnerState,
  trackId: string,
  cellId: string,
  phase: EffectPhase,
  build: (effectId: string) => Effect,
): TransitionResult {
  const effectSeq = state.effectSeq + 1;
  const effectId = `e${effectSeq}`;
  return {
    state: {
      ...state,
      effectSeq,
      inFlight: {
        ...state.inFlight,
        [effectId]: { effectId, trackId, cellId, phase },
      },
    },
    effects: [build(effectId)],
  };
}

function emitRunCommand(
  state: RunnerState,
  trackId: string,
  cellId: string,
  command: ResolvedCommandValue,
  family: SensorFamily,
  source: CommandSource,
  deviceIds: string[],
): TransitionResult {
  return emitEffect(state, trackId, cellId, "runCommand", (effectId) => ({
    kind: "runCommand",
    effectId,
    trackId,
    cellId,
    input: { trackId, cellId, command, family, source, deviceIds },
  }));
}

function scopedDevices(state: RunnerState, track: Track): DeviceRef[] {
  const allowed = new Set(track.deviceIds);
  return state.devices.filter((device) => allowed.has(device.id));
}

/** The `$device` context for a connection id (first device when unspecified). */
function deviceContextOf(devices: DeviceRef[], deviceId?: string): DeviceContext | undefined {
  const index = deviceId ? devices.findIndex((d) => d.id === deviceId) : 0;
  const device = devices[Math.max(index, 0)] as DeviceRef | undefined;
  if (!device) return undefined;
  return toDeviceContext(
    {
      family: device.family,
      name: device.deviceName,
      deviceId: device.deviceId,
      firmwareVersion: device.firmwareVersion,
      batteryPercent: device.batteryPercent,
    },
    Math.max(index, 0),
  );
}

export type AnswerRecording =
  | { kind: "rejected"; state: RunnerState }
  | { kind: "recorded"; state: RunnerState };

/**
 * Validate and record an answer on the current cycle (shared by both modes):
 * required questions reject blank values, blank optional answers delete the
 * key, the already-launched question run completes, and a CHANGED value marks
 * downstream producers stale.
 */
export function recordAnswer(
  state: RunnerState,
  cellId: string,
  value: string,
  path?: CellPath,
): AnswerRecording {
  const cell = cellById(state.cells, cellId, path);
  if (cell?.type !== "question") {
    return { kind: "rejected", state: ignored(state, "ANSWER").state };
  }

  const required = (cell.question as { required?: boolean }).required ?? false;
  const blank = value.trim() === "";
  if (required && blank) {
    return {
      kind: "rejected",
      state: failRun(
        trace(state, `ANSWER rejected: question ${cellId} is required`),
        cellId,
        "Answer required",
      ),
    };
  }

  const existing = currentAnswers(state)[cellId];
  const changed = existing !== undefined && existing !== value;

  const answers = { ...currentAnswers(state) };
  if (blank) {
    delete answers[cellId];
  } else {
    answers[cellId] = value;
  }
  let next: RunnerState = {
    ...state,
    answersByCycle: state.answersByCycle.map((m, i) => (i === state.cycle ? answers : m)),
  };
  next = completeRun(next, cellId);
  if (changed) next = markDownstreamStale(next, cellId);
  return { kind: "recorded", state: next };
}

/** Record a per-cell failure; mode decides pause vs continue at the call site. */
export function failRun(
  state: RunnerState,
  cellId: string,
  error: string,
  executionTimeMs?: number,
): RunnerState {
  const prev = state.cellRuns[cellId];
  const outputs = { ...state.outputs };
  delete outputs[cellId];
  return setCellRun({ ...state, outputs }, cellId, {
    status: "error",
    error,
    executionOrder: prev?.executionOrder ?? [],
    executionTimeMs,
  });
}

function producerFamily(state: RunnerState): SensorFamily {
  return state.options.deviceFamily ?? "generic";
}

/**
 * Emit the effect(s) that start a producer cell. Protocol cells chain through
 * code resolution; inline command cells validate synchronously; macros get the
 * verbatim upstream `json` plus the normalized ctx namespace.
 */
export function startProducer(
  state: RunnerState,
  trackId: string,
  cellId: string,
): TransitionResult {
  const trackPath = getTrack(state, trackId).cursor.body;
  const cell = cellById(state.cells, cellId, trackPath);
  if (!cell) return fatal(state, `startProducer: unknown cell ${cellId}`);

  let next = stampRun(state, cellId);
  next = setTrack(next, { ...getTrack(next, trackId), progress: null, status: "active" });
  const track = getTrack(next, trackId);
  const devices = scopedDevices(next, track);

  if (cell.type === "protocol") {
    return emitEffect(next, trackId, cellId, "resolveProtocolCode", (effectId) => ({
      kind: "resolveProtocolCode",
      effectId,
      trackId,
      cellId,
      protocolId: cell.payload.protocolId,
      version: cell.payload.version,
    }));
  }

  if (isCommandCell(cell)) {
    const resolved = validateInlineCommand(cell.payload);
    if (!resolved.ok) {
      return { state: failRun(next, cellId, resolved.error), effects: [] };
    }
    return emitRunCommand(
      next,
      trackId,
      cellId,
      resolved.value,
      producerFamily(next),
      { kind: "inlineCell", format: cell.payload.format },
      track.deviceIds,
    );
  }

  if (cell.type === "macro") {
    const upstreamId = nearestUpstreamProducerId(next.cells, cellId);
    const upstream = upstreamId ? next.outputs[upstreamId] : undefined;
    const hydrated = asWorkbookCells(
      hydrateCells(next.cells, currentAnswers(next), next.outputs, {
        // buildCellNamespace is the macro-read normalization boundary. Keeping
        // device values raw here lets it reject one bad device without
        // poisoning valid sibling legs.
        normalizeDeviceOutputs: false,
      }),
    );
    const idx = cellIndex(next.cells, cellId, track.cursor.body);
    const base = {
      trackId,
      cellId,
      macroId: cell.payload.macroId,
      language: cell.payload.language,
      deviceIds: track.deviceIds,
    };

    // Multi-device upstream: the macro runs once per device's measurement,
    // each leg reading a ctx scoped to ITS results plus its own $device entry.
    // Devices whose measurement failed carry their error through untouched.
    const allowed = new Set(track.deviceIds);
    const inputResults = upstream?.deviceResults?.filter(
      (result) =>
        (trackId === MAIN_TRACK_ID && state.devices.length === 0) || allowed.has(result.deviceId),
    );
    if (inputResults && inputResults.length > 0) {
      const legs: MacroLeg[] = inputResults.map((r) => {
        const identity = {
          deviceId: r.deviceId,
          deviceLabel: r.deviceLabel ?? r.deviceId,
          family: r.family,
          deviceName: r.deviceName,
        };
        if (r.error !== undefined || r.data == null) {
          // The upstream cell already reports its own error; the macro leg
          // carries the generic no-data message (web parity).
          return {
            kind: "carriedFailure",
            outcome: { ...identity, error: "No measurement data from this device" },
          };
        }
        try {
          const ctx = buildCellNamespace(hydrated, idx, {
            deviceId: r.deviceId,
            device: deviceContextOf(devices, r.deviceId),
            consumer: { path: track.cursor.body, cellId },
          });
          return { kind: "run", input: { ...base, ...identity, json: r.data, ctx } };
        } catch (error) {
          if (!isOutputDataNormalizationError(error)) throw error;
          return { kind: "carriedFailure", outcome: { ...identity, error: error.message } };
        }
      });
      return emitEffect(next, trackId, cellId, "runMacro", (effectId) => ({
        kind: "runMacro",
        effectId,
        trackId,
        cellId,
        legs,
      }));
    }

    const json = upstream?.v ?? null;
    let ctx;
    try {
      ctx = buildCellNamespace(hydrated, idx, {
        device: deviceContextOf(devices),
        consumer: { path: track.cursor.body, cellId },
      });
    } catch (error) {
      if (!isOutputDataNormalizationError(error)) throw error;
      return { state: failRun(next, cellId, error.message), effects: [] };
    }
    return emitEffect(next, trackId, cellId, "runMacro", (effectId) => ({
      kind: "runMacro",
      effectId,
      trackId,
      cellId,
      legs: [{ kind: "run", input: { ...base, json, ctx } }],
    }));
  }

  return fatal(state, `startProducer: cell ${cellId} is not a producer`);
}

/** Second step of a protocol cell: run the resolved code as a command. */
export function startResolvedProtocolCommand(
  state: RunnerState,
  trackId: string,
  cellId: string,
  code: Record<string, unknown>[],
): TransitionResult {
  const track = getTrack(state, trackId);
  const cell = cellById(state.cells, cellId, track.cursor.body);
  if (cell?.type !== "protocol") return fatal(state, `resolved code for non-protocol ${cellId}`);
  const deviceIds = isDispatchTarget(state, trackId, cellId)
    ? (track.dispatch?.queue[track.dispatch.index]?.deviceIds ?? track.deviceIds)
    : track.deviceIds;
  return emitRunCommand(
    state,
    trackId,
    cellId,
    code,
    producerFamily(state),
    {
      kind: "protocolCell",
      protocolId: cell.payload.protocolId,
      version: cell.payload.version,
    },
    deviceIds,
  );
}

/**
 * Validated macro artifact -> synthetic dispatch step. Position stays at the
 * macro cell; the dispatch step id owns the in-flight effect and its output.
 */
export function startArtifactDispatch(
  state: RunnerState,
  trackId: string,
  macroCellId: string,
  artifact: MacroArtifact,
): TransitionResult {
  const validated = validateCommandArtifact(artifact, {
    family: state.options.deviceFamily,
    allowDeviceWrites: state.options.allowDeviceWrites,
  });
  if (!validated.ok) {
    return { state: failRun(state, macroCellId, validated.reason), effects: [] };
  }

  const stepId = dispatchStepId(macroCellId);
  let next = stampRun(state, stepId);
  next = setTrack(trace(next, `dispatch ${artifact.__ojArtifact} constructed by ${macroCellId}`), {
    ...getTrack(next, trackId),
    progress: null,
    status: "active",
  });
  return emitRunCommand(
    next,
    trackId,
    stepId,
    validated.command,
    validated.family,
    {
      kind: "artifact",
      artifact: artifact.__ojArtifact,
      producedBy: macroCellId,
    },
    getTrack(next, trackId).deviceIds,
  );
}

function fatal(state: RunnerState, reason: string): TransitionResult {
  return {
    state: { ...trace(state, `fatal: ${reason}`), fatalReason: reason },
    effects: [],
  };
}

interface BranchResolution {
  state: RunnerState;
  nextCellId: string | null;
  jumped: boolean;
}

/**
 * Pure branch routing: loop-cap check before increment (the 100th visit
 * routes, the 101st falls through), production evaluateBranch over hydrated
 * cells, first match wins, sequential fall-through otherwise. Every forward
 * resolution records a return-stack entry so Back never lands on a branch;
 * chained branches replace the top entry; backward jumps record nothing.
 */
function resolveBranch(
  state: RunnerState,
  trackId: string,
  cell: BranchCell,
  enteredVia: EnteredVia,
): BranchResolution {
  const track = getTrack(state, trackId);
  const visits = track.branchVisits[cell.id] ?? 0;
  if (visits >= state.options.maxBranchVisits) {
    const next = trace(state, `branch ${cell.id} capped`);
    return { state: next, nextCellId: nextTrackCellId(next, trackId, cell.id), jumped: false };
  }

  let next = setTrack(state, {
    ...track,
    branchVisits: { ...track.branchVisits, [cell.id]: visits + 1 },
  });

  const hydrated = hydrateCells(next.cells, currentAnswers(next), next.outputs);
  const matched = evaluateBranch(cell, asWorkbookCells(hydrated), {
    consumer: { path: track.cursor.body, cellId: cell.id },
  });

  next = setCellRun(next, cell.id, {
    status: "completed",
    executionOrder: next.cellRuns[cell.id]?.executionOrder ?? [],
    lastMatchedPathId: matched?.id,
  });

  const branchIdx = cellIndex(next.cells, cell.id, track.cursor.body);
  let target: string | null = null;
  let jumped = false;
  if (matched?.gotoCellId && matched.gotoCellId !== cell.id) {
    const resolved = resolveGotoCellId(next.cells, matched.gotoCellId, cell.id, track.cursor.body);
    if (resolved !== null) {
      target = resolved;
      jumped = true;
    }
  }
  target ??= nextTrackCellId(next, trackId, cell.id);

  if (next.mode === "flow" && target !== null) {
    const targetIdx = cellIndex(next.cells, target, track.cursor.body);
    const backward = jumped && targetIdx < branchIdx;
    if (!backward) {
      const returnTo = previousTrackCellId(next, trackId, cell.id);
      const nextTrack = getTrack(next, trackId);
      const top = stackTop(nextTrack.returnStack);
      const chained = enteredVia === "jump" && top?.landingCellId === cell.id;
      const entry = chained
        ? { landingCellId: target, returnToCellId: top.returnToCellId }
        : { landingCellId: target, returnToCellId: returnTo };
      const returnStack = chained
        ? [...nextTrack.returnStack.slice(0, -1), entry]
        : [...nextTrack.returnStack, entry];
      next = setTrack(next, { ...nextTrack, returnStack });
    }
  }

  return { state: next, nextCellId: target, jumped };
}

/**
 * Device-scoped branch = dispatcher (web parity): every connected device
 * evaluates the branch with ITS identity, devices group by resolved path, and
 * each path's protocol/command target runs against only its group, one
 * target at a time (single in-flight effect). Devices matching no path are
 * skipped with a message, never an error. No jump: execution continues after
 * the branch, and consumed targets are skipped once by the linear walk.
 */
function startDeviceDispatch(
  state: RunnerState,
  trackId: string,
  cell: BranchCell,
): TransitionResult {
  const track = getTrack(state, trackId);
  const visits = track.branchVisits[cell.id] ?? 0;
  if (visits >= state.options.maxBranchVisits) {
    const capped = trace(state, `branch ${cell.id} capped`);
    return landOn(capped, nextTrackCellId(capped, trackId, cell.id), "forward", trackId);
  }
  let next = setTrack(state, {
    ...track,
    branchVisits: { ...track.branchVisits, [cell.id]: visits + 1 },
  });
  const devices = scopedDevices(next, getTrack(next, trackId));

  if (devices.length === 0) {
    const failed = {
      ...failRun(next, cell.id, "No device connected - connect devices to dispatch"),
      runAllActive: false,
    };
    return afterCellFailure(failed, trackId, cell.id);
  }

  const hydrated = asWorkbookCells(hydrateCells(next.cells, currentAnswers(next), next.outputs));
  const groups = new Map<string, DeviceRef[]>();
  const skipped: DeviceRef[] = [];
  devices.forEach((device, index) => {
    const path = evaluateBranch(cell, hydrated, {
      device: deviceContextOf(devices, device.id) ?? {
        family: device.family,
        index,
      },
      deviceId: device.id,
      consumer: { path: track.cursor.body, cellId: cell.id },
    });
    const target = path?.gotoCellId
      ? cellById(next.cells, path.gotoCellId, track.cursor.body)
      : undefined;
    if (path && target && (target.type === "protocol" || target.type === "command")) {
      const group = groups.get(path.id);
      if (group) group.push(device);
      else groups.set(path.id, [device]);
    } else {
      skipped.push(device);
    }
  });

  const messages: string[] = [];
  const queue: { targetCellId: string; deviceIds: string[] }[] = [];
  const dispatchConsumed = { ...getTrack(next, trackId).dispatchConsumed };
  for (const path of cell.paths) {
    const group = groups.get(path.id);
    if (!group || group.length === 0 || !path.gotoCellId) continue;
    messages.push(`${path.label || "Unnamed path"} -> ${group.map((g) => g.label).join(", ")}`);
    queue.push({ targetCellId: path.gotoCellId, deviceIds: group.map((g) => g.id) });
    dispatchConsumed[path.gotoCellId] = true;
  }
  for (const s of skipped) {
    messages.push(`${s.label} (${s.family}): no measurement resolved this round`);
  }

  // A dispatcher matches several paths at once; no single ACTIVE path.
  next = setCellRun(next, cell.id, {
    status: "completed",
    executionOrder: next.cellRuns[cell.id]?.executionOrder ?? [],
    lastMatchedPathId: undefined,
  });
  next = trace(next, `dispatch branch ${cell.id}: ${queue.length} target(s)`);
  next = {
    ...next,
    outputs: { ...next.outputs, [cell.id]: { v: undefined, messages } },
  };
  next = setTrack(next, {
    ...getTrack(next, trackId),
    dispatch: { branchCellId: cell.id, queue, index: 0 },
    dispatchConsumed,
  });
  return startNextDispatchTarget(next, trackId);
}

/** Start the current dispatch target, or finish the branch when the queue is done. */
export function startNextDispatchTarget(state: RunnerState, trackId: string): TransitionResult {
  const track = getTrack(state, trackId);
  const dispatch = track.dispatch;
  if (!dispatch) return fatal(state, "startNextDispatchTarget without an active dispatch");
  if (state.stopRequested) {
    return {
      state: setTrack(trace(state, `dispatch on ${trackId} stopped before next target`), {
        ...track,
        dispatch: null,
        dispatchConsumed: {},
        progress: null,
      }),
      effects: [],
    };
  }
  if (dispatch.index >= dispatch.queue.length) {
    const done = setTrack(state, { ...track, dispatch: null });
    return landOn(done, nextTrackCellId(done, trackId, dispatch.branchCellId), "forward", trackId);
  }

  const { targetCellId, deviceIds } = dispatch.queue[dispatch.index];
  const cell = cellById(state.cells, targetCellId, track.cursor.body);
  if (!cell) return fatal(state, `dispatch target ${targetCellId} not found`);

  let next = stampRun(state, targetCellId);
  next = setTrack(next, { ...getTrack(next, trackId), status: "active", progress: null });

  if (cell.type === "protocol") {
    return emitEffect(next, trackId, targetCellId, "resolveProtocolCode", (effectId) => ({
      kind: "resolveProtocolCode",
      effectId,
      trackId,
      cellId: targetCellId,
      protocolId: cell.payload.protocolId,
      version: cell.payload.version,
    }));
  }
  if (isCommandCell(cell)) {
    const resolved = validateInlineCommand(cell.payload);
    if (!resolved.ok) {
      return advanceDispatch(failRun(next, targetCellId, resolved.error), trackId);
    }
    return emitRunCommand(
      next,
      trackId,
      targetCellId,
      resolved.value,
      producerFamily(next),
      { kind: "inlineCell", format: cell.payload.format },
      deviceIds,
    );
  }
  return fatal(state, `dispatch target ${targetCellId} is not a protocol or command cell`);
}

/** Move an active dispatch past its current target (after completion or failure). */
export function advanceDispatch(state: RunnerState, trackId: string): TransitionResult {
  const track = getTrack(state, trackId);
  const dispatch = track.dispatch;
  if (!dispatch) return fatal(state, "advanceDispatch without an active dispatch");
  return startNextDispatchTarget(
    setTrack(state, { ...track, dispatch: { ...dispatch, index: dispatch.index + 1 } }),
    trackId,
  );
}

/** True when the in-flight effect cell is the active dispatch target. */
export function isDispatchTarget(
  state: RunnerState,
  trackId: string,
  effectCellId: string,
): boolean {
  const dispatch = getTrack(state, trackId).dispatch;
  return dispatch !== null && dispatch.queue[dispatch.index]?.targetCellId === effectCellId;
}

const TERMINAL_TRACK_STATUSES = new Set<Track["status"]>(["done", "partial", "failed", "skipped"]);

function activeParallelAttempt(state: RunnerState): ParallelContainerAttempt | undefined {
  return state.activeContainerAttemptId
    ? state.parallelAttempts[state.activeContainerAttemptId]
    : undefined;
}

function parallelAttemptContext(attempt: ParallelContainerAttempt): ParallelContextEntry {
  const lanes = Object.fromEntries(
    Object.values(attempt.lanes).map((lane) => [
      lane.laneId,
      {
        label: lane.label,
        status: lane.status as ParallelLaneTerminalStatus,
        devices: lane.devices,
      },
    ]),
  );
  return {
    attemptId: attempt.attemptId,
    ...Object.fromEntries(
      Object.values(attempt.lanes).map((lane) => [
        lane.laneId,
        lane.status as ParallelLaneTerminalStatus,
      ]),
    ),
    lanes,
  };
}

/** One attempt-isolation boundary shared by fresh entry, loop re-entry, and restart. */
function purgeParallelContainerState(state: RunnerState, container: ParallelCell): RunnerState {
  const nestedIds = new Set(container.lanes.flatMap((lane) => lane.body.map((cell) => cell.id)));
  const outputs = { ...state.outputs };
  const cellRuns = { ...state.cellRuns };
  delete outputs[container.id];
  delete cellRuns[container.id];
  for (const cellId of nestedIds) {
    delete outputs[cellId];
    delete outputs[dispatchStepId(cellId)];
    delete cellRuns[cellId];
    delete cellRuns[dispatchStepId(cellId)];
  }
  const answersByCycle = state.answersByCycle.map((answers) => {
    const next = { ...answers };
    for (const cellId of nestedIds) delete next[cellId];
    return next;
  });
  const parallelContexts = { ...state.parallelContexts };
  delete parallelContexts[sanitizeQuestionLabel(container.name)];
  return { ...state, outputs, cellRuns, answersByCycle, parallelContexts };
}

function laneDeviceOutcomes(
  state: RunnerState,
  lane: ParallelLaneAttempt,
): ParallelLaneDeviceOutcome[] {
  if (lane.trackId === null) return [];
  const track = state.tracks[lane.trackId];
  const body = workbookBodyAtPath(state.cells, track.cursor.body) ?? [];
  const producerIds = new Set(body.filter(isProducer).map((cell) => cell.id));
  const results = [...producerIds].flatMap((producerId) => {
    const ordinary = state.outputs[producerId]?.deviceResults ?? [];
    const dispatch = state.outputs[dispatchStepId(producerId)]?.deviceResults ?? [];
    return [...ordinary, ...dispatch];
  });

  return lane.deviceIds.map((deviceId) => {
    const matching = results.filter((result) => result.deviceId === deviceId);
    const failed = matching.some((result) => result.error !== undefined);
    return { deviceId, outcome: failed ? "failed" : "ok" };
  });
}

function terminalLaneStatus(
  track: Track,
  devices: ParallelLaneDeviceOutcome[],
): ParallelLaneTerminalStatus {
  if (track.status === "failed" || track.status === "skipped") return track.status;
  const failed = devices.some((device) => device.outcome === "failed");
  const succeeded = devices.some((device) => device.outcome === "ok");
  return failed && succeeded ? "partial" : failed ? "failed" : "done";
}

function syncParallelAttempt(state: RunnerState): RunnerState {
  const attempt = activeParallelAttempt(state);
  if (!attempt) return state;
  let tracks = state.tracks;
  const lanes = Object.fromEntries(
    Object.entries(attempt.lanes).map(([laneId, lane]) => {
      if (lane.trackId === null) return [laneId, lane];
      const track = state.tracks[lane.trackId];
      const devices = laneDeviceOutcomes(state, lane);
      const status = TERMINAL_TRACK_STATUSES.has(track.status)
        ? terminalLaneStatus(track, devices)
        : track.status;
      if (status !== track.status) {
        tracks = { ...tracks, [track.id]: { ...track, status } };
      }
      return [
        laneId,
        {
          ...lane,
          status,
          devices,
          terminalReason: track.terminalReason,
        } satisfies ParallelLaneAttempt,
      ];
    }),
  );
  return {
    ...state,
    tracks,
    parallelAttempts: { ...state.parallelAttempts, [attempt.attemptId]: { ...attempt, lanes } },
  };
}

/**
 * Snapshot-safe normalization for an interrupted attempt. Nested values and
 * run records are attempt-local even though their maps are keyed only by cell
 * id, so they must be removed before a fresh attempt can be confirmed.
 */
export function parkParallelAttemptForRestart(state: RunnerState): RunnerState {
  const attempt = activeParallelAttempt(state);
  if (!attempt || attempt.status === "complete") return state;
  const container = cellById(state.cells, attempt.containerCellId);
  if (container?.type !== "parallel") return state;
  const purged = purgeParallelContainerState(state, container);
  const tracks = Object.fromEntries(
    Object.entries(purged.tracks).filter(
      ([trackId]) =>
        trackId === MAIN_TRACK_ID ||
        !Object.values(attempt.lanes).some((lane) => lane.trackId === trackId),
    ),
  );
  const main = tracks[MAIN_TRACK_ID];
  tracks[MAIN_TRACK_ID] = {
    ...main,
    status: "awaitingHuman",
    terminalReason: undefined,
    progress: null,
    dispatch: null,
    dispatchConsumed: {},
    pendingInteraction: { kind: "restart", cellId: attempt.containerCellId },
    cursor: {
      body: main.cursor.body,
      cellId: attempt.containerCellId,
      enteredVia: "jump",
      atStart: false,
    },
  };

  return {
    ...trace(purged, `parallel attempt ${attempt.attemptId} parked for restart confirmation`),
    tracks,
    inFlight: {},
    cancellingEffectIds: {},
    abandoningTrackIds: {},
    runAllActive: false,
    stopRequested: false,
    parallelAttempts: {
      ...state.parallelAttempts,
      [attempt.attemptId]: { ...attempt, status: "awaitingRestart" },
    },
  };
}

/** Finish an explicitly stopped/cancelled attempt without releasing work past its barrier. */
export function abortActiveParallelAttempt(state: RunnerState, reason: string): RunnerState {
  if (Object.keys(state.inFlight).length > 0 || Object.keys(state.cancellingEffectIds).length > 0) {
    return state;
  }
  const synced = syncParallelAttempt(state);
  const attempt = activeParallelAttempt(synced);
  if (!attempt) return synced;
  const laneTrackIds = new Set(
    Object.values(attempt.lanes)
      .map((lane) => lane.trackId)
      .filter((trackId): trackId is string => trackId !== null),
  );
  const lanes = Object.fromEntries(
    Object.entries(attempt.lanes).map(([laneId, lane]) => {
      const track = lane.trackId ? synced.tracks[lane.trackId] : undefined;
      const terminal = track && TERMINAL_TRACK_STATUSES.has(track.status);
      return [
        laneId,
        terminal
          ? lane
          : {
              ...lane,
              status: "skipped" as const,
              terminalReason: reason,
              devices: laneDeviceOutcomes(synced, lane),
            },
      ];
    }),
  );
  const completed = { ...attempt, status: "complete" as const, lanes };
  const context = parallelAttemptContext(completed);
  const tracks = Object.fromEntries(
    Object.entries(synced.tracks).filter(([trackId]) => !laneTrackIds.has(trackId)),
  );
  const main = tracks[MAIN_TRACK_ID];
  tracks[MAIN_TRACK_ID] = {
    ...main,
    status: "active",
    terminalReason: undefined,
    pendingInteraction: null,
    progress: null,
    dispatch: null,
    dispatchConsumed: {},
    cursor: { ...main.cursor, cellId: attempt.containerCellId, enteredVia: "jump" },
  };
  const previousRun = synced.cellRuns[attempt.containerCellId];
  return trace(
    {
      ...synced,
      tracks,
      runAllActive: false,
      stopRequested: false,
      abandoningTrackIds: {},
      activeContainerAttemptId: null,
      parallelAttempts: { ...synced.parallelAttempts, [attempt.attemptId]: completed },
      parallelContexts: { ...synced.parallelContexts, [attempt.containerName]: context },
      outputs: { ...synced.outputs, [attempt.containerCellId]: { v: context } },
      cellRuns: {
        ...synced.cellRuns,
        [attempt.containerCellId]: {
          status: "cancelled",
          executionOrder: previousRun?.executionOrder ?? [],
        },
      },
    },
    `parallel attempt ${attempt.attemptId} ${reason.toLowerCase()}`,
  );
}

/** Remove the parked attempt shell immediately before confirmed re-entry. */
export function discardParkedParallelAttempt(state: RunnerState): RunnerState {
  const attempt = activeParallelAttempt(state);
  if (attempt?.status !== "awaitingRestart") return state;
  const parallelAttempts = { ...state.parallelAttempts };
  delete parallelAttempts[attempt.attemptId];
  const main = getTrack(state, MAIN_TRACK_ID);
  return setTrack(
    {
      ...state,
      parallelAttempts,
      activeContainerAttemptId: null,
    },
    {
      ...main,
      status: "active",
      pendingInteraction: null,
      terminalReason: undefined,
    },
  );
}

/**
 * Resolve the named wait-all barrier after a lane becomes terminal. Failures,
 * partial outcomes and researcher skips all count as terminal; only then does
 * the main track advance past the container.
 */
export function settleParallelBarrier(state: RunnerState): TransitionResult {
  let next = syncParallelAttempt(state);
  const attempt = activeParallelAttempt(next);
  if (!attempt) return { state: next, effects: [] };
  const lanes = Object.values(attempt.lanes);
  if (!lanes.every((lane) => TERMINAL_TRACK_STATUSES.has(lane.status))) {
    return { state: next, effects: [] };
  }

  const completed = { ...attempt, status: "complete" as const };
  const context = parallelAttemptContext(completed);
  next = completeRun(
    {
      ...trace(next, `parallel barrier ${attempt.containerCellId} released`),
      outputs: {
        ...next.outputs,
        [attempt.containerCellId]: { v: context },
      },
      parallelAttempts: { ...next.parallelAttempts, [attempt.attemptId]: completed },
      activeContainerAttemptId: null,
      parallelContexts: {
        ...next.parallelContexts,
        [attempt.containerName]: context,
      },
    },
    attempt.containerCellId,
  );
  const main = getTrack(next, MAIN_TRACK_ID);
  next = setTrack(next, {
    ...main,
    status: "active",
    pendingInteraction: null,
    terminalReason: undefined,
  });
  if (next.mode === "notebook" && !next.runAllActive) {
    return { state: next, effects: [] };
  }
  return landOn(
    next,
    nextTrackCellId(next, MAIN_TRACK_ID, attempt.containerCellId),
    "forward",
    MAIN_TRACK_ID,
  );
}

function enterParallelContainer(state: RunnerState, container: ParallelCell): TransitionResult {
  if (activeParallelAttempt(state)) {
    return fatal(
      state,
      `parallel container ${container.id} entered while another attempt is active`,
    );
  }
  const prepared = purgeParallelContainerState(state, container);
  const main = getTrack(prepared, MAIN_TRACK_ID);
  const devices = scopedDevices(prepared, main);
  let assignment;
  try {
    assignment = assignParallelLanes(
      container,
      prepared.cells,
      devices.map((device) => ({
        deviceId: device.id,
        device: deviceContextOf(devices, device.id) ?? { family: device.family, index: 0 },
      })),
    );
  } catch (error) {
    return fatal(
      state,
      error instanceof Error ? error.message : `invalid container ${container.id}`,
    );
  }

  const containerAttemptSeq = prepared.containerAttemptSeq + 1;
  const attemptId = `${container.id}:${containerAttemptSeq}`;
  const lanes = Object.fromEntries(
    container.lanes.map((lane) => {
      const deviceIds = assignment.lanes[lane.id] ?? [];
      const trackId = deviceIds.length > 0 ? `${container.id}#${attemptId}:${lane.id}` : null;
      return [
        lane.id,
        {
          laneId: lane.id,
          label: lane.label,
          trackId,
          deviceIds,
          status: trackId === null ? "skipped" : "active",
          devices:
            trackId === null ? [] : deviceIds.map((deviceId) => ({ deviceId, outcome: "ok" })),
          ...(trackId === null ? { terminalReason: "No devices assigned" } : {}),
        } satisfies ParallelLaneAttempt,
      ];
    }),
  );
  const attempt: ParallelContainerAttempt = {
    attemptId,
    containerCellId: container.id,
    containerName: sanitizeQuestionLabel(container.name),
    status: "running",
    lanes,
  };
  let next = stampRun(
    {
      ...prepared,
      containerAttemptSeq,
      activeContainerAttemptId: attemptId,
      parallelAttempts: { ...prepared.parallelAttempts, [attemptId]: attempt },
    },
    container.id,
  );
  next = setTrack(next, {
    ...main,
    status: "active",
    pendingInteraction: null,
    cursor: { ...main.cursor, cellId: container.id, enteredVia: "forward", atStart: false },
  });

  const specs = container.lanes.flatMap((lane) => {
    const laneAttempt = lanes[lane.id];
    if (laneAttempt.trackId === null) return [];
    const body = [...main.cursor.body, { containerCellId: container.id, laneId: lane.id }];
    return [
      {
        id: laneAttempt.trackId,
        laneId: lane.id,
        deviceIds: laneAttempt.deviceIds,
        body,
        cellId: firstExecutableCellId(next.cells, body),
      },
    ];
  });
  next = spawnTracks(next, specs);
  if (next.fatalReason !== null) return { state: next, effects: [] };

  const effects: Effect[] = [];
  for (const spec of [...specs].sort((a, b) => a.id.localeCompare(b.id))) {
    const launched = landOn(next, spec.cellId, "forward", spec.id);
    next = launched.state;
    effects.push(...launched.effects);
    if (next.fatalReason !== null) break;
  }
  if (specs.length === 0) return settleParallelBarrier(next);
  return { state: next, effects };
}

function endOfFlow(
  state: RunnerState,
  trackId: string,
): { state: RunnerState; continueAt: string | null } {
  const track = getTrack(state, trackId);
  if (state.mode === "notebook" || !state.options.loop || trackId !== MAIN_TRACK_ID) {
    return {
      state: setTrack(
        trackId === MAIN_TRACK_ID ? { ...state, runAllActive: false, stopRequested: false } : state,
        {
          ...track,
          status: trackId !== MAIN_TRACK_ID || state.mode === "flow" ? "done" : "active",
          pendingInteraction: null,
          cursor: { body: track.cursor.body, cellId: null, enteredVia: "forward", atStart: false },
        },
      ),
      continueAt: null,
    };
  }
  // Cycle wrap: fresh answers map and run records; outputs and the Jupyter
  // counter survive (mobile keeps scanResult across the wrap).
  let wrapped: RunnerState = {
    ...trace(state, `cycle ${state.cycle + 1} start`),
    cycle: state.cycle + 1,
    answersByCycle: [...state.answersByCycle, {}],
    cellRuns: {},
  };
  wrapped = setTrack(wrapped, {
    ...track,
    status: "active",
    branchVisits: {},
    returnStack: [],
    dispatch: null,
    dispatchConsumed: {},
    progress: null,
    pendingInteraction: null,
  });
  return {
    state: wrapped,
    continueAt: firstExecutableCellId(wrapped.cells, getTrack(wrapped, trackId).cursor.body),
  };
}

/**
 * Move to a cell and process until the runtime suspends: interactive cells
 * await input, producers go running (single in-flight effect), branches route
 * inline. Iterative on purpose; branch loops are bounded by the visit cap.
 *
 * Entry semantics: "forward" applies the skip rule (completed and not stale
 * passes through, everything else runs), "jump" always runs (a branch loop
 * means re-measure), "back" is passive and never emits effects.
 */
export function landOn(
  state: RunnerState,
  cellId: string | null,
  via: EnteredVia,
  trackId: string = MAIN_TRACK_ID,
): TransitionResult {
  let current = cellId;
  let entryVia = via;
  let s = state;

  for (;;) {
    if (s.stopRequested) {
      const track = getTrack(s, trackId);
      const drained =
        Object.keys(s.inFlight).length === 0 && Object.keys(s.cancellingEffectIds).length === 0;
      if (drained && activeParallelAttempt(s)) {
        return { state: abortActiveParallelAttempt(s, "Stopped by researcher"), effects: [] };
      }
      const stopped = drained ? { ...s, runAllActive: false, stopRequested: false } : s;
      return {
        state: setTrack(trace(stopped, `track ${trackId} stopped`), {
          ...track,
          status: "active",
          pendingInteraction: null,
          cursor: {
            body: track.cursor.body,
            cellId: current,
            enteredVia: entryVia,
            atStart: false,
          },
        }),
        effects: [],
      };
    }

    if (current === null) {
      const ended = endOfFlow(s, trackId);
      if (trackId !== MAIN_TRACK_ID) return settleParallelBarrier(ended.state);
      if (ended.continueAt === null) return { state: ended.state, effects: [] };
      s = ended.state;
      current = ended.continueAt;
      entryVia = "forward";
      continue;
    }

    const currentTrack = getTrack(s, trackId);
    const cell = cellById(s.cells, current, currentTrack.cursor.body);
    if (!cell) return fatal(s, `unknown cell ${current}`);

    const track = getTrack(s, trackId);
    s = setTrack(s, {
      ...track,
      status: "active",
      pendingInteraction: null,
      cursor: {
        body: track.cursor.body,
        cellId: current,
        enteredVia: entryVia,
        atStart: isAtStart(s, trackId, current),
      },
    });

    if (cell.type === "markdown") {
      if (s.mode === "notebook") {
        current = nextTrackCellId(s, trackId, current);
        entryVia = "forward";
        continue;
      }
      return {
        state: setTrack(s, {
          ...getTrack(s, trackId),
          status: "awaitingHuman",
          pendingInteraction: { kind: "instruction", cellId: cell.id },
        }),
        effects: [],
      };
    }

    if (cell.type === "question") {
      // Web parity: a notebook run rejects a question that has no text yet.
      if (s.mode === "notebook" && cell.question.text.trim() === "") {
        return afterCellFailure(
          failRun(s, cell.id, "Question text is required: add a question before running"),
          trackId,
          cell.id,
        );
      }
      const stamped = stampRun(s, cell.id);
      return {
        state: setTrack(stamped, {
          ...getTrack(stamped, trackId),
          status: "awaitingHuman",
          pendingInteraction: { kind: "question", cellId: cell.id },
        }),
        effects: [],
      };
    }

    if (cell.type === "branch") {
      if (entryVia === "back") {
        return {
          state: setTrack(s, {
            ...getTrack(s, trackId),
            status: "awaitingHuman",
            pendingInteraction: { kind: "resume", cellId: cell.id },
          }),
          effects: [],
        };
      }
      // Web parity: notebook validates every branch config; flow validates
      // only device-scoped ones (field flows legitimately use default-only paths).
      const deviceScoped = isDeviceScopedBranch(cell);
      if (deviceScoped || s.mode === "notebook") {
        const errors = [
          ...validateBranchCell(cell, { requireDefault: false }),
          ...(deviceScoped ? validateDeviceBranch(cell, asWorkbookCells(s.cells)) : []),
        ];
        if (errors.length > 0) {
          return afterCellFailure(
            { ...failRun(s, cell.id, errors.join("; ")), runAllActive: false },
            trackId,
            cell.id,
          );
        }
      }
      let dispatch: TransitionResult | undefined;
      let resolved: BranchResolution | undefined;
      try {
        if (deviceScoped) dispatch = startDeviceDispatch(s, trackId, cell);
        else resolved = resolveBranch(s, trackId, cell, entryVia);
      } catch (error) {
        if (!isOutputDataNormalizationError(error)) throw error;
        return afterCellFailure(
          { ...failRun(s, cell.id, error.message), runAllActive: false },
          trackId,
          cell.id,
        );
      }
      if (dispatch) return dispatch;
      if (!resolved) return fatal(s, `branch ${cell.id} did not resolve`);
      s = resolved.state;
      if (s.fatalReason !== null) return { state: s, effects: [] };
      current = resolved.nextCellId;
      entryVia = resolved.jumped ? "jump" : "forward";
      continue;
    }

    if (cell.type === "parallel") {
      if (trackId !== MAIN_TRACK_ID) {
        return fatal(s, `nested parallel container ${cell.id} is unsupported`);
      }
      if (entryVia === "back") {
        return {
          state: setTrack(s, {
            ...getTrack(s, trackId),
            status: "awaitingHuman",
            pendingInteraction: { kind: "resume", cellId: cell.id },
          }),
          effects: [],
        };
      }
      if (
        s.mode === "flow" &&
        entryVia === "forward" &&
        s.cellRuns[cell.id]?.status === "completed"
      ) {
        current = nextTrackCellId(s, trackId, cell.id);
        entryVia = "forward";
        continue;
      }
      return enterParallelContainer(s, cell);
    }

    if (isProducer(cell)) {
      if (entryVia === "back") {
        return {
          state: setTrack(s, {
            ...getTrack(s, trackId),
            status: "awaitingHuman",
            pendingInteraction: { kind: "resume", cellId: cell.id },
          }),
          effects: [],
        };
      }
      // A dispatch already ran this target against its device group; the
      // linear walk skips it exactly once instead of re-running it.
      if (entryVia === "forward" && getTrack(s, trackId).dispatchConsumed[cell.id]) {
        const currentTrack = getTrack(s, trackId);
        const dispatchConsumed = { ...currentTrack.dispatchConsumed };
        delete dispatchConsumed[cell.id];
        s = setTrack(trace(s, `skip ${cell.id}: dispatched`), {
          ...currentTrack,
          dispatchConsumed,
        });
        current = nextTrackCellId(s, trackId, cell.id);
        entryVia = "forward";
        continue;
      }
      const run = s.cellRuns[cell.id];
      const skip = s.mode === "flow" && entryVia === "forward" && run?.status === "completed";
      if (skip) {
        current = nextTrackCellId(s, trackId, current);
        entryVia = "forward";
        continue;
      }
      const started = startProducer(s, trackId, cell.id);
      if (started.state.cellRuns[cell.id]?.status === "error") {
        // Synchronous validation failure (bad inline command payload).
        return afterCellFailure(started.state, trackId, cell.id);
      }
      return started;
    }

    return fatal(s, `cell ${current} of type ${cell.type} is not executable`);
  }
}

/** Mode-specific continuation after a per-cell failure was recorded. */
export function afterCellFailure(
  state: RunnerState,
  trackId: string,
  cellId: string,
): TransitionResult {
  const track = getTrack(state, trackId);
  let cleared = setTrack(state, { ...track, progress: null });
  if (trackId !== MAIN_TRACK_ID) {
    const error = cleared.cellRuns[cellId]?.error ?? "Cell failed";
    return settleParallelBarrier(
      setTrack(cleared, {
        ...getTrack(cleared, trackId),
        status: "failed",
        terminalReason: error,
        pendingInteraction: null,
        cursor: { ...getTrack(cleared, trackId).cursor, cellId },
      }),
    );
  }
  if (cleared.mode === "flow") {
    const error = cleared.cellRuns[cellId]?.error ?? "Cell failed";
    cleared = setTrack(cleared, {
      ...getTrack(cleared, trackId),
      status: "failed",
      terminalReason: error,
      pendingInteraction: { kind: "error", cellId },
      cursor: { ...getTrack(cleared, trackId).cursor, cellId },
    });
    return {
      state: { ...cleared, runAllActive: false, stopRequested: false },
      effects: [],
    };
  }
  if (cleared.runAllActive) {
    // Notebook passes record the error and keep going (web parity).
    return landOn(cleared, nextTrackCellId(cleared, trackId, cellId), "forward", trackId);
  }
  return {
    state: setTrack(cleared, {
      ...getTrack(cleared, trackId),
      status: "active",
      pendingInteraction: null,
    }),
    effects: [],
  };
}
