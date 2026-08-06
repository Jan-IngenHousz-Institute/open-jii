import { parseMacroArtifact } from "../artifact/macro-artifact";
import {
  cellById,
  dispatchStepId,
  firstExecutableCellId,
  isExecutable,
  nextCellId,
  prevCellId,
} from "../flow/flow-utils";
import type { OutputEntry } from "../flow/hydrate";
import {
  advanceDispatch,
  abortActiveParallelAttempt,
  afterCellFailure,
  completeRun,
  discardParkedParallelAttempt,
  failRun,
  ignored,
  isDispatchTarget,
  landOn,
  lastOrder,
  markDownstreamStale,
  ownerCellId,
  recordAnswer,
  setCellRun,
  settleParallelBarrier,
  stackTop,
  startArtifactDispatch,
  startNextDispatchTarget,
  startResolvedProtocolCommand,
} from "./cell-entry";
import type { Effect, TransitionResult } from "./effects";
import type { RetryTarget, WorkbookEvent, WorkbookInternalEvent } from "./events";
import { isInternalEvent } from "./events";
import type { RunnerState } from "./state";
import {
  createInitialState,
  currentAnswers,
  getTrack,
  MAIN_TRACK_ID,
  setTrack,
  trace,
  withDerivedStatus,
} from "./state";

export { spawnTracks } from "./state";

function noop(state: RunnerState, line?: string): TransitionResult {
  return { state: line ? trace(state, line) : state, effects: [] };
}

// Most events behave identically in both modes; the mode split lives in these
// two gates alone. Flow owns the cursor vocabulary, notebook owns passes.
const FLOW_ONLY = new Set<WorkbookEvent["type"]>([
  "START",
  "NEXT",
  "CONTINUE_TRACK",
  "BACK",
  "START_CYCLE",
]);
const NOTEBOOK_ONLY = new Set<WorkbookEvent["type"]>(["CLEAR_OUTPUTS"]);

/** Launch active tracks in deterministic id order, folding effectSeq globally. */
export function scheduleTracks(state: RunnerState, trackIds: readonly string[]): TransitionResult {
  let next = state;
  const effects: Effect[] = [];
  for (const trackId of [...new Set(trackIds)].sort()) {
    if (!Object.prototype.hasOwnProperty.call(next.tracks, trackId)) continue;
    const track = next.tracks[trackId];
    const alreadyInFlight = Object.values(next.inFlight).some(
      (effect) => effect?.trackId === trackId,
    );
    if (track.status !== "active" || alreadyInFlight || next.stopRequested) continue;
    const started = landOn(next, track.cursor.cellId, track.cursor.enteredVia, trackId);
    next = started.state;
    effects.push(...started.effects);
    if (next.fatalReason !== null) break;
  }
  return finish({ state: next, effects });
}

function finish(result: TransitionResult, finalizeStopped = false): TransitionResult {
  let state = result.state;
  const hasLiveHumanInteraction = Object.values(state.tracks).some(
    (track) =>
      track.pendingInteraction?.kind === "question" ||
      track.pendingInteraction?.kind === "instruction",
  );
  if (
    finalizeStopped &&
    state.stopRequested &&
    Object.keys(state.inFlight).length === 0 &&
    Object.keys(state.cancellingEffectIds).length === 0 &&
    !hasLiveHumanInteraction
  ) {
    state = {
      ...trace(state, "all stopped effects drained"),
      runAllActive: false,
      stopRequested: false,
    };
  }
  return { state: withDerivedStatus(state), effects: result.effects };
}

function mainTrack(state: RunnerState) {
  return getTrack(state, MAIN_TRACK_ID);
}

function nextTrackCellId(state: RunnerState, trackId: string, cellId: string): string | null {
  return nextCellId(state.cells, cellId, getTrack(state, trackId).cursor.body);
}

function clearTrackInteraction(state: RunnerState, trackId: string): RunnerState {
  const track = getTrack(state, trackId);
  return setTrack(state, {
    ...track,
    status: "active",
    terminalReason: undefined,
    pendingInteraction: null,
  });
}

// ── Shared handlers (mode-free) ─────────────────────

function handleAnswer(
  state: RunnerState,
  trackId: string,
  cellId: string,
  value: string,
): TransitionResult {
  if (Object.keys(state.cancellingEffectIds).length > 0) return ignored(state, "ANSWER");
  if (!Object.prototype.hasOwnProperty.call(state.tracks, trackId))
    return ignored(state, "ANSWER unknown track");
  const track = state.tracks[trackId];
  const awaitedHere =
    track.pendingInteraction?.kind === "question" &&
    track.pendingInteraction.cellId === cellId &&
    track.cursor.cellId === cellId;
  const recording = recordAnswer(state, cellId, value, track.cursor.body);
  if (recording.kind === "rejected") return { state: recording.state, effects: [] };

  let next = recording.state;
  if (awaitedHere) {
    next = clearTrackInteraction(next, trackId);
    if (next.stopRequested) {
      const stoppedTrack = getTrack(next, trackId);
      return {
        state: setTrack(trace(next, `track ${trackId} answer stored while stopped`), {
          ...stoppedTrack,
          status: "active",
          cursor: {
            ...stoppedTrack.cursor,
            cellId: nextTrackCellId(next, trackId, cellId),
            enteredVia: "forward",
            atStart: false,
          },
        }),
        effects: [],
      };
    }
    return landOn(next, nextTrackCellId(next, trackId, cellId), "forward", trackId);
  }
  return { state: next, effects: [] };
}

function handleRunCell(state: RunnerState, cellId: string): TransitionResult {
  if (Object.keys(state.inFlight).length > 0 || Object.keys(state.cancellingEffectIds).length > 0) {
    return ignored(state, "RUN_CELL");
  }
  const cell = cellById(state.cells, cellId);
  if (!cell || !isExecutable(cell)) return ignored(state, "RUN_CELL");
  if (cell.type === "markdown" && state.mode === "notebook") return ignored(state, "RUN_CELL");

  const main = mainTrack(state);
  let next = setTrack(state, {
    ...main,
    status: "active",
    terminalReason: undefined,
    pendingInteraction: null,
    branchVisits: cell.type === "branch" ? {} : main.branchVisits,
  });
  next = {
    ...next,
    stopRequested: false,
    runAllActive: state.mode === "notebook" && cell.type === "branch",
  };
  return landOn(next, cellId, "jump", MAIN_TRACK_ID);
}

function handleStop(state: RunnerState): TransitionResult {
  const hasActiveWork = Object.keys(state.inFlight).length > 0;
  if (!hasActiveWork && state.activeContainerAttemptId) {
    return { state: abortActiveParallelAttempt(state, "Stopped by researcher"), effects: [] };
  }
  const hasLiveHumanInteraction = Object.values(state.tracks).some(
    (track) =>
      track.pendingInteraction?.kind === "question" ||
      track.pendingInteraction?.kind === "instruction",
  );
  if (!state.runAllActive && !hasActiveWork && !hasLiveHumanInteraction) {
    return ignored(state, "STOP");
  }
  return {
    state: {
      ...trace(state, "STOP gated new work; human interactions remain live"),
      runAllActive: hasActiveWork ? state.runAllActive : false,
      stopRequested: hasActiveWork || hasLiveHumanInteraction,
    },
    effects: [],
  };
}

function markCancelledTrack(
  state: RunnerState,
  trackId: string,
  effectCellId: string,
): RunnerState {
  const owner = ownerCellId(effectCellId);
  let next = state;
  const mark = (id: string) => {
    const prev = next.cellRuns[id];
    next = setCellRun(next, id, {
      status: "cancelled",
      executionOrder: prev?.executionOrder ?? [],
    });
  };
  mark(effectCellId);
  if (owner !== effectCellId) mark(owner);
  const track = getTrack(next, trackId);
  const preserveDispatch = isDispatchTarget(next, trackId, effectCellId);
  return setTrack(trace(next, `cancelled ${effectCellId} on ${trackId}`), {
    ...track,
    status: state.mode === "flow" ? "awaitingHuman" : "active",
    progress: null,
    dispatch: preserveDispatch ? track.dispatch : null,
    dispatchConsumed: preserveDispatch ? track.dispatchConsumed : {},
    pendingInteraction: state.mode === "flow" ? { kind: "resume", cellId: owner } : null,
    cursor: { ...track.cursor, cellId: owner },
  });
}

function handleCancel(state: RunnerState): TransitionResult {
  const effectIds = Object.keys(state.inFlight).sort();
  if (effectIds.length > 0) {
    const cancellingEffectIds = Object.fromEntries(effectIds.map((id) => [id, true] as const));
    return {
      state: { ...state, cancellingEffectIds },
      effects: [{ kind: "cancelEffects", effectIds }],
    };
  }

  if (state.activeContainerAttemptId) {
    return { state: abortActiveParallelAttempt(state, "Cancelled by researcher"), effects: [] };
  }

  const main = mainTrack(state);
  if (main.pendingInteraction?.kind === "error") {
    const cur = main.cursor.cellId;
    let next = setTrack(state, {
      ...main,
      status: "awaitingHuman",
      terminalReason: undefined,
      pendingInteraction: cur ? { kind: "resume", cellId: cur } : null,
    });
    if (cur !== null) {
      const cellRuns = { ...next.cellRuns };
      delete cellRuns[cur];
      delete cellRuns[dispatchStepId(cur)];
      next = { ...next, cellRuns };
    }
    return { state: next, effects: [] };
  }
  if (state.runAllActive) {
    return {
      state: { ...trace(state, "pass aborted"), runAllActive: false, stopRequested: false },
      effects: [],
    };
  }
  return ignored(state, "CANCEL");
}

function handleAbandonLane(state: RunnerState, trackId: string): TransitionResult {
  const attempt = state.activeContainerAttemptId
    ? state.parallelAttempts[state.activeContainerAttemptId]
    : undefined;
  const lane = attempt
    ? Object.values(attempt.lanes).find((candidate) => candidate.trackId === trackId)
    : undefined;
  const track = state.tracks[trackId];
  if (!lane) return ignored(state, "ABANDON_LANE");
  if (["done", "partial", "failed", "skipped"].includes(track.status)) {
    return ignored(state, "ABANDON_LANE terminal");
  }

  const effectIds = Object.values(state.inFlight)
    .filter((effect): effect is NonNullable<typeof effect> => effect?.trackId === trackId)
    .map((effect) => effect.effectId)
    .sort();
  if (effectIds.length > 0) {
    return {
      state: {
        ...trace(state, `abandon lane ${lane.laneId}: cancelling ${effectIds.join(",")}`),
        cancellingEffectIds: {
          ...state.cancellingEffectIds,
          ...Object.fromEntries(effectIds.map((effectId) => [effectId, true] as const)),
        },
        abandoningTrackIds: { ...state.abandoningTrackIds, [trackId]: true },
      },
      effects: [{ kind: "cancelEffects", effectIds }],
    };
  }

  return settleParallelBarrier(
    setTrack(trace(state, `abandon lane ${lane.laneId}`), {
      ...track,
      status: "skipped",
      terminalReason: "Abandoned by researcher",
      pendingInteraction: null,
      progress: null,
      dispatch: null,
      dispatchConsumed: {},
    }),
  );
}

function handleReset(state: RunnerState): TransitionResult {
  const effectIds = Object.keys(state.inFlight).sort();
  const effects: Effect[] = effectIds.length > 0 ? [{ kind: "cancelEffects", effectIds }] : [];
  const fresh = createInitialState({
    cells: state.cells,
    mode: state.mode,
    loop: state.options.loop,
    maxBranchVisits: state.options.maxBranchVisits,
    allowDeviceWrites: state.options.allowDeviceWrites,
    allowMacroArtifactDispatch: state.options.allowMacroArtifactDispatch,
    pauseAfterInlineCommand: state.options.pauseAfterInlineCommand,
    deviceFamily: state.options.deviceFamily,
    devices: state.devices,
  });
  // effectSeq survives so completions from before the reset can never match.
  return { state: { ...fresh, effectSeq: state.effectSeq }, effects };
}

// ── Flow navigation handlers ────────────────────────

function requiredUnanswered(state: RunnerState, cellId: string): boolean {
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "question") return false;
  const required = (cell.question as { required?: boolean }).required ?? false;
  const answer = currentAnswers(state)[cellId];
  return required && (answer === undefined || answer.trim() === "");
}

function handleStart(state: RunnerState): TransitionResult {
  const main = mainTrack(state);
  if (state.status !== "idle" || main.cursor.cellId !== null) return ignored(state, "START");
  return landOn(state, firstExecutableCellId(state.cells), "forward", MAIN_TRACK_ID);
}

function handleNext(state: RunnerState): TransitionResult {
  if (Object.keys(state.cancellingEffectIds).length > 0) return ignored(state, "NEXT");
  const main = mainTrack(state);
  if (!main.pendingInteraction) return ignored(state, "NEXT");
  const cur = main.cursor.cellId;
  if (cur === null) return ignored(state, "NEXT");
  const cell = cellById(state.cells, cur);
  if (!cell) return ignored(state, "NEXT");

  if (cell.type === "markdown") {
    return landOn(
      clearTrackInteraction(state, MAIN_TRACK_ID),
      nextCellId(state.cells, cur, main.cursor.body),
      "forward",
    );
  }
  if (cell.type === "question") {
    if (requiredUnanswered(state, cur)) {
      return {
        state: trace(state, `NEXT blocked: question ${cur} requires an answer`),
        effects: [],
      };
    }
    return landOn(
      clearTrackInteraction(state, MAIN_TRACK_ID),
      nextCellId(state.cells, cur, main.cursor.body),
      "forward",
    );
  }
  if (cell.type === "branch") {
    return landOn(clearTrackInteraction(state, MAIN_TRACK_ID), cur, "forward", MAIN_TRACK_ID);
  }
  if (state.cellRuns[cur]?.status === "completed") {
    return landOn(
      clearTrackInteraction(state, MAIN_TRACK_ID),
      nextCellId(state.cells, cur, main.cursor.body),
      "forward",
    );
  }
  return ignored(state, "NEXT");
}

function handleContinueTrack(
  state: RunnerState,
  trackId: string,
  cellId: string,
): TransitionResult {
  if (Object.keys(state.cancellingEffectIds).length > 0) {
    return ignored(state, "CONTINUE_TRACK");
  }
  if (trackId === MAIN_TRACK_ID || !Object.prototype.hasOwnProperty.call(state.tracks, trackId)) {
    return ignored(state, "CONTINUE_TRACK unknown lane");
  }
  const track = state.tracks[trackId];
  if (
    track.cursor.cellId !== cellId ||
    track.pendingInteraction?.kind !== "instruction" ||
    track.pendingInteraction.cellId !== cellId
  ) {
    return ignored(state, "CONTINUE_TRACK stale interaction");
  }
  return landOn(
    clearTrackInteraction(state, trackId),
    nextTrackCellId(state, trackId, cellId),
    "forward",
    trackId,
  );
}

function handleBack(state: RunnerState): TransitionResult {
  if (Object.keys(state.cancellingEffectIds).length > 0) return ignored(state, "BACK");
  const main = mainTrack(state);
  if (!main.pendingInteraction) return ignored(state, "BACK");
  const cur = main.cursor.cellId;
  if (cur === null) return ignored(state, "BACK");

  let next = clearTrackInteraction(state, MAIN_TRACK_ID);
  let track = mainTrack(next);
  let target: string | null;
  const top = stackTop(track.returnStack);
  if (top?.landingCellId === cur) {
    track = { ...track, returnStack: track.returnStack.slice(0, -1) };
    next = setTrack(next, track);
    target = top.returnToCellId;
  } else {
    target = prevCellId(next.cells, cur, track.cursor.body);
  }
  while (target !== null && cellById(next.cells, target, track.cursor.body)?.type === "branch") {
    target = prevCellId(next.cells, target, track.cursor.body);
  }

  if (target === null) {
    return {
      state: setTrack(next, {
        ...mainTrack(next),
        status: "awaitingHuman",
        pendingInteraction: { kind: "resume", cellId: cur },
        cursor: { ...mainTrack(next).cursor, atStart: true },
      }),
      effects: [],
    };
  }
  return landOn(next, target, "back", MAIN_TRACK_ID);
}

function handleRetry(state: RunnerState, target: RetryTarget | undefined): TransitionResult {
  if (Object.keys(state.cancellingEffectIds).length > 0) return ignored(state, "RETRY");
  if (!target) return ignored(state, "RETRY missing target");
  if (target.kind === "containerAttempt") {
    const attempt = state.parallelAttempts[target.attemptId];
    const main = mainTrack(state);
    const confirmed =
      state.activeContainerAttemptId === target.attemptId &&
      attempt?.containerCellId === target.containerCellId &&
      attempt.status === "awaitingRestart" &&
      main.pendingInteraction?.kind === "restart" &&
      main.pendingInteraction.cellId === target.containerCellId;
    if (!confirmed) return ignored(state, "RETRY containerAttempt");
    const next = discardParkedParallelAttempt(state);
    return landOn(next, target.containerCellId, "jump", MAIN_TRACK_ID);
  }
  if (target.kind !== "postCancel") {
    return noop(
      state,
      `unsupported RETRY target ${target.kind}; lane retry requires an active attempt`,
    );
  }
  if (!Object.prototype.hasOwnProperty.call(state.tracks, target.trackId))
    return ignored(state, "RETRY");
  const track = state.tracks[target.trackId];
  const pendingDispatchTarget =
    track.dispatch?.queue.some(({ targetCellId }) => targetCellId === target.cellId) ?? false;
  if (track.cursor.cellId !== target.cellId && !pendingDispatchTarget) {
    return ignored(state, "RETRY");
  }
  const run = state.cellRuns[target.cellId];
  const retryable =
    track.pendingInteraction?.kind === "error" ||
    track.pendingInteraction?.kind === "resume" ||
    run?.status === "cancelled" ||
    run?.status === "interrupted" ||
    run?.status === "error";
  if (!retryable) return ignored(state, "RETRY");
  const cell = cellById(state.cells, target.cellId, track.cursor.body);
  if (!cell || cell.type === "markdown" || cell.type === "question") {
    return ignored(state, "RETRY");
  }
  const cleared = clearTrackInteraction(state, target.trackId);
  return pendingDispatchTarget
    ? startNextDispatchTarget(cleared, target.trackId)
    : landOn(cleared, target.cellId, "jump", target.trackId);
}

function handleStartCycle(state: RunnerState): TransitionResult {
  if (
    state.status !== "awaitingInput" &&
    state.status !== "pausedError" &&
    state.status !== "done"
  ) {
    return ignored(state, "START_CYCLE");
  }
  const main = mainTrack(state);
  let wrapped: RunnerState = {
    ...trace(state, `cycle ${state.cycle + 1} start (explicit)`),
    cycle: state.cycle + 1,
    answersByCycle: [...state.answersByCycle, {}],
    outputs: {},
    cellRuns: {},
  };
  wrapped = setTrack(wrapped, {
    ...main,
    status: "active",
    terminalReason: undefined,
    branchVisits: {},
    returnStack: [],
    dispatch: null,
    dispatchConsumed: {},
    progress: null,
    pendingInteraction: null,
  });
  return landOn(wrapped, firstExecutableCellId(wrapped.cells), "forward", MAIN_TRACK_ID);
}

/** Host roster sync updates main only; lane track scopes stay frozen. */
function handleSetDevices(state: RunnerState, devices: RunnerState["devices"]): TransitionResult {
  const main = mainTrack(state);
  return {
    state: setTrack(
      { ...state, devices },
      { ...main, deviceIds: devices.map((device) => device.id) },
    ),
    effects: [],
  };
}

// ── Notebook pass handlers ──────────────────────────

function handleRunAll(state: RunnerState): TransitionResult {
  if (Object.keys(state.inFlight).length > 0 || Object.keys(state.cancellingEffectIds).length > 0) {
    return ignored(state, "RUN_ALL");
  }
  const resumableTrackIds = Object.keys(state.tracks).filter(
    (trackId) => trackId !== MAIN_TRACK_ID,
  );
  if (state.stopRequested && resumableTrackIds.length > 0) {
    const resumed = {
      ...trace(
        state,
        `parallel attempt ${state.activeContainerAttemptId ?? "tracks"} explicitly resumed`,
      ),
      stopRequested: false,
      runAllActive: true,
    };
    return scheduleTracks(resumed, resumableTrackIds);
  }
  const main = mainTrack(state);
  let next: RunnerState = {
    ...state,
    cellRuns: {},
    execCounter: 0,
    stopRequested: false,
    runAllActive: true,
  };
  next = setTrack(next, {
    ...main,
    status: "active",
    terminalReason: undefined,
    branchVisits: {},
    dispatch: null,
    dispatchConsumed: {},
    progress: null,
    pendingInteraction: null,
  });
  return landOn(next, firstExecutableCellId(next.cells), "forward", MAIN_TRACK_ID);
}

function handleClearOutputs(state: RunnerState): TransitionResult {
  if (Object.keys(state.inFlight).length > 0 || Object.keys(state.cancellingEffectIds).length > 0) {
    return ignored(state, "CLEAR_OUTPUTS");
  }
  const main = mainTrack(state);
  return {
    state: setTrack(
      {
        ...state,
        outputs: {},
        cellRuns: {},
        execCounter: 0,
        runAllActive: false,
        stopRequested: false,
      },
      {
        ...main,
        status: "active",
        terminalReason: undefined,
        branchVisits: {},
        returnStack: [],
        dispatch: null,
        dispatchConsumed: {},
        progress: null,
        pendingInteraction: null,
        cursor: { body: main.cursor.body, cellId: null, enteredVia: "forward", atStart: false },
      },
    ),
    effects: [],
  };
}

// ── Internal completions ────────────────────────────

function deleteEffect(state: RunnerState, effectId: string, trackId: string): RunnerState {
  const inFlight = { ...state.inFlight };
  delete inFlight[effectId];
  const track = getTrack(state, trackId);
  return setTrack({ ...state, inFlight }, { ...track, progress: null });
}

function continueAfterCompletion(
  state: RunnerState,
  trackId: string,
  flowCellId: string,
): TransitionResult {
  if (state.mode === "flow" || state.runAllActive) {
    return landOn(state, nextTrackCellId(state, trackId, flowCellId), "forward", trackId);
  }
  return { state, effects: [] };
}

function recordCompletion(
  state: RunnerState,
  effectId: string,
  trackId: string,
  cellId: string,
  entry: OutputEntry,
  timings: { startedAt: number; endedAt: number },
): RunnerState {
  const cleared = deleteEffect(state, effectId, trackId);
  const next: RunnerState = {
    ...cleared,
    outputs: { ...cleared.outputs, [cellId]: entry },
  };
  return completeRun(next, cellId, timings.endedAt - timings.startedAt);
}

function failEffect(
  state: RunnerState,
  trackId: string,
  effectCellId: string,
  error: string,
  extra?: { deviceResults?: OutputEntry["deviceResults"]; messages?: string[] },
): TransitionResult {
  const owner = ownerCellId(effectCellId);
  let next = failRun(state, effectCellId, error);
  if (extra?.deviceResults) {
    next = {
      ...next,
      outputs: {
        ...next.outputs,
        [effectCellId]: {
          v: undefined,
          deviceResults: extra.deviceResults,
          messages: extra.messages,
        },
      },
    };
  }
  if (isDispatchTarget(next, trackId, effectCellId)) {
    return advanceDispatch(next, trackId, effectCellId);
  }
  if (owner !== effectCellId) {
    const prev = next.cellRuns[owner];
    next = setCellRun(next, owner, {
      status: "error",
      error,
      executionOrder: prev?.executionOrder ?? [],
    });
  }
  return afterCellFailure(next, trackId, owner);
}

function acknowledgeCancel(
  state: RunnerState,
  event: WorkbookInternalEvent,
  trackId: string,
): TransitionResult {
  let next = deleteEffect(state, event.effectId, trackId);
  const cancellingEffectIds = { ...next.cancellingEffectIds };
  delete cancellingEffectIds[event.effectId];
  next = markCancelledTrack({ ...next, cancellingEffectIds }, trackId, event.cellId);
  if (next.abandoningTrackIds[trackId]) {
    const abandoningTrackIds = { ...next.abandoningTrackIds };
    delete abandoningTrackIds[trackId];
    next = setTrack(
      { ...next, abandoningTrackIds },
      {
        ...getTrack(next, trackId),
        status: "skipped",
        terminalReason: "Abandoned by researcher",
        pendingInteraction: null,
        progress: null,
        dispatch: null,
        dispatchConsumed: {},
      },
    );
    return settleParallelBarrier(next);
  }
  if (Object.keys(cancellingEffectIds).length === 0) {
    next = next.activeContainerAttemptId
      ? abortActiveParallelAttempt(next, "Cancelled by researcher")
      : { ...next, runAllActive: false, stopRequested: false };
  }
  return { state: next, effects: [] };
}

function handleInternal(state: RunnerState, event: WorkbookInternalEvent): TransitionResult {
  const owned = state.inFlight[event.effectId];
  if (!owned) {
    return noop(state, `dropped stale ${event.type} (${event.effectId})`);
  }
  if (owned.trackId !== event.trackId || owned.cellId !== event.cellId) {
    return noop(state, `dropped misrouted ${event.type} (${event.effectId})`);
  }

  if (state.cancellingEffectIds[event.effectId]) {
    if (event.type === "COMMAND_PROGRESS") return noop(state);
    return acknowledgeCancel(state, event, owned.trackId);
  }
  if (event.type === "EFFECT_CANCELLED") {
    return noop(state, `dropped unsolicited EFFECT_CANCELLED (${event.effectId})`);
  }

  switch (event.type) {
    case "COMMAND_PROGRESS": {
      const track = getTrack(state, owned.trackId);
      return { state: setTrack(state, { ...track, progress: event.progress }), effects: [] };
    }

    case "CODE_RESOLVED": {
      const cleared = deleteEffect(state, event.effectId, owned.trackId);
      if (!event.code || event.code.length === 0) {
        return failEffect(cleared, owned.trackId, event.cellId, "Invalid or missing protocol JSON");
      }
      if (cleared.stopRequested) {
        const prev = cleared.cellRuns[event.cellId];
        return landOn(
          setCellRun(cleared, event.cellId, {
            status: "interrupted",
            executionOrder: prev?.executionOrder ?? [],
          }),
          event.cellId,
          "jump",
          owned.trackId,
        );
      }
      return startResolvedProtocolCommand(cleared, owned.trackId, event.cellId, event.code);
    }

    case "CODE_RESOLVE_FAILED": {
      const cleared = deleteEffect(state, event.effectId, owned.trackId);
      return failEffect(cleared, owned.trackId, event.cellId, event.error);
    }

    case "MACRO_FAILED":
    case "COMMAND_FAILED": {
      const cleared = deleteEffect(state, event.effectId, owned.trackId);
      return failEffect(cleared, owned.trackId, event.cellId, event.error, {
        deviceResults: event.deviceResults,
        messages: event.messages,
      });
    }

    case "MACRO_DONE": {
      let next = recordCompletion(
        state,
        event.effectId,
        owned.trackId,
        event.cellId,
        { v: event.output, deviceResults: event.deviceResults, messages: event.messages },
        event.timings,
      );
      next = markDownstreamStale(next, event.cellId);
      if (next.stopRequested) {
        return landOn(
          next,
          nextTrackCellId(next, owned.trackId, event.cellId),
          "forward",
          owned.trackId,
        );
      }
      // Macro-as-command construction (#1718) is host policy, never inferred
      // from result shape. Web constructs the runner with this capability off.
      const artifact = next.options.allowMacroArtifactDispatch
        ? parseMacroArtifact(event.output)
        : null;
      if (artifact !== null) {
        const dispatch = startArtifactDispatch(next, owned.trackId, event.cellId, artifact);
        if (dispatch.state.cellRuns[event.cellId]?.status === "error") {
          return afterCellFailure(dispatch.state, owned.trackId, event.cellId);
        }
        return dispatch;
      }
      return continueAfterCompletion(next, owned.trackId, event.cellId);
    }

    case "COMMAND_DONE": {
      const owner = ownerCellId(event.cellId);
      let next = recordCompletion(
        state,
        event.effectId,
        owned.trackId,
        event.cellId,
        { v: event.output, deviceResults: event.deviceResults, messages: event.messages },
        event.timings,
      );
      next = markDownstreamStale(next, owner, lastOrder(next.cellRuns[event.cellId]));
      if (isDispatchTarget(next, owned.trackId, event.cellId)) {
        return advanceDispatch(next, owned.trackId, event.cellId);
      }
      const completedCell = cellById(next.cells, owner, getTrack(next, owned.trackId).cursor.body);
      if (next.options.pauseAfterInlineCommand && completedCell?.type === "command") {
        return {
          state: setTrack(next, {
            ...getTrack(next, owned.trackId),
            status: "awaitingHuman",
            pendingInteraction: { kind: "instruction", cellId: owner },
          }),
          effects: [],
        };
      }
      return continueAfterCompletion(next, owned.trackId, owner);
    }
  }
}

export function transition(state: RunnerState, event: WorkbookEvent): TransitionResult {
  if (state.fatalReason !== null) return finish(noop(state));
  if (isInternalEvent(event)) return finish(handleInternal(state, event), true);

  if (state.mode === "notebook" && FLOW_ONLY.has(event.type)) {
    return finish(ignored(state, event.type));
  }
  if (state.mode === "flow" && NOTEBOOK_ONLY.has(event.type)) {
    return finish(ignored(state, event.type));
  }

  let result: TransitionResult;
  switch (event.type) {
    case "ANSWER":
      result = handleAnswer(state, event.trackId, event.cellId, event.value);
      break;
    case "RUN_CELL":
      result = handleRunCell(state, event.cellId);
      break;
    case "CANCEL":
      result = handleCancel(state);
      break;
    case "ABANDON_LANE":
      result = handleAbandonLane(state, event.trackId);
      break;
    case "RESET":
      result = handleReset(state);
      break;
    case "STOP":
      result = handleStop(state);
      break;
    case "START":
      result = handleStart(state);
      break;
    case "NEXT":
      result = handleNext(state);
      break;
    case "CONTINUE_TRACK":
      result = handleContinueTrack(state, event.trackId, event.cellId);
      break;
    case "BACK":
      result = handleBack(state);
      break;
    case "RETRY":
      result = handleRetry(state, event.target);
      break;
    case "START_CYCLE":
      result = handleStartCycle(state);
      break;
    case "RUN_ALL":
      result = handleRunAll(state);
      break;
    case "CLEAR_OUTPUTS":
      result = handleClearOutputs(state);
      break;
    case "SET_DEVICES":
      result = handleSetDevices(state, event.devices);
      break;
  }
  return finish(result);
}
