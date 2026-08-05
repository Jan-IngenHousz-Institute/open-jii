import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import { branchCell, commandCell, protocolCell, questionCell } from "../demo/fixtures";
import type { Effect } from "./effects";
import type { WorkbookInternalEvent } from "./events";
import { scheduleTracks, spawnTracks, transition } from "./reducer";
import type { DeviceRef } from "./state";
import { createInitialState, pendingTrackInteractions } from "./state";

const TIMINGS = { startedAt: 10, endedAt: 15 };

function commandCompletion(
  effect: Extract<Effect, { kind: "runCommand" }>,
  output: unknown = { ok: effect.trackId },
): Extract<WorkbookInternalEvent, { type: "COMMAND_DONE" }> {
  return {
    type: "COMMAND_DONE",
    effectId: effect.effectId,
    trackId: effect.trackId,
    cellId: effect.cellId,
    output,
    timings: TIMINGS,
  };
}

function twoCommands(mode: "flow" | "notebook" = "notebook") {
  const cells = [commandCell("cA"), commandCell("cB")];
  let state = createInitialState({ cells, mode });
  state = spawnTracks(state, [
    { id: "lane-B", laneId: "B", deviceIds: ["dev-B"], cellId: "cB" },
    { id: "lane-A", laneId: "A", deviceIds: ["dev-A"], cellId: "cA" },
  ]);
  const started = scheduleTracks(state, ["lane-B", "lane-A"]);
  const effects = started.effects.filter(
    (effect): effect is Extract<Effect, { kind: "runCommand" }> => effect.kind === "runCommand",
  );
  expect(effects.map((effect) => [effect.effectId, effect.trackId])).toEqual([
    ["e1", "lane-A"],
    ["e2", "lane-B"],
  ]);
  return { started, effects };
}

describe("scheduler spine: two-effect lifecycle matrix", () => {
  it.each([
    { verb: "CANCEL" as const, order: [0, 1] },
    { verb: "CANCEL" as const, order: [1, 0] },
    { verb: "STOP" as const, order: [0, 1] },
    { verb: "STOP" as const, order: [1, 0] },
    { verb: "RESET" as const, order: [0, 1] },
    { verb: "RESET" as const, order: [1, 0] },
    { verb: "RUN_ALL" as const, order: [0, 1] },
    { verb: "RUN_ALL" as const, order: [1, 0] },
  ])("drains $verb with completions in order $order", ({ verb, order }) => {
    // STOP uses flow continuation so the test proves no new producer starts;
    // other verbs use notebook mode to isolate completion ownership.
    const { started, effects } = twoCommands(verb === "STOP" ? "flow" : "notebook");
    const crossed = transition(started.state, { type: verb });

    if (verb === "CANCEL" || verb === "RESET") {
      expect(crossed.effects).toEqual([{ kind: "cancelEffects", effectIds: ["e1", "e2"] }]);
    } else {
      expect(crossed.effects).toEqual([]);
    }

    let state = crossed.state;
    const emitted: Effect[] = [];
    for (const [completionIndex, index] of order.entries()) {
      const completed = transition(state, commandCompletion(effects[index]));
      state = completed.state;
      emitted.push(...completed.effects);
      if (verb === "CANCEL" && completionIndex === 0) {
        expect(state.status).toBe("cancelling");
        expect(Object.keys(state.inFlight)).toHaveLength(1);
        expect(Object.keys(state.cancellingEffectIds)).toHaveLength(1);
      }
    }

    expect(state.inFlight).toEqual({});
    expect(state.cancellingEffectIds).toEqual({});
    if (verb === "CANCEL") {
      expect(state.outputs).toEqual({});
      expect(state.cellRuns.cA?.status).toBe("cancelled");
      expect(state.cellRuns.cB?.status).toBe("cancelled");
    } else if (verb === "RESET") {
      expect(state.outputs).toEqual({});
      expect(Object.keys(state.tracks)).toEqual(["main"]);
    } else {
      expect(state.outputs.cA?.v).toEqual({ ok: "lane-A" });
      expect(state.outputs.cB?.v).toEqual({ ok: "lane-B" });
    }
    if (verb === "STOP") {
      expect(emitted).toEqual([]);
      expect(state.stopRequested).toBe(false);
    }
    if (verb === "RUN_ALL") {
      expect(state.trace[state.trace.length - 1]).toContain("ignored RUN_ALL");
    }
  });
});

describe("scheduler spine: ownership and routing", () => {
  it("chains protocol resolution to a command on the same track and subset", () => {
    const cells = [protocolCell("pA")];
    let state = createInitialState({ cells, mode: "notebook" });
    state = spawnTracks(state, [{ id: "lane-A", laneId: "A", deviceIds: ["dev-A"], cellId: "pA" }]);
    let step = scheduleTracks(state, ["lane-A"]);
    const resolver = step.effects[0];
    if (resolver.kind !== "resolveProtocolCode") throw new Error("expected resolver");

    step = transition(step.state, {
      type: "CODE_RESOLVED",
      effectId: resolver.effectId,
      trackId: resolver.trackId,
      cellId: resolver.cellId,
      code: [{ type: "scan" }],
      timings: TIMINGS,
    });
    const command = step.effects[0];
    if (command.kind !== "runCommand") throw new Error("expected command");
    expect(command.effectId).toBe("e2");
    expect(command.trackId).toBe("lane-A");
    expect(command.input.trackId).toBe("lane-A");
    expect(command.input.deviceIds).toEqual(["dev-A"]);
    expect(Object.values(step.state.inFlight)).toEqual([
      expect.objectContaining({ effectId: "e2", trackId: "lane-A", cellId: "pA" }),
    ]);
  });

  it("STOP does not turn a completed protocol resolution into a new command effect", () => {
    const cells = [protocolCell("pA")];
    let state = createInitialState({ cells, mode: "flow" });
    state = spawnTracks(state, [{ id: "lane-A", laneId: "A", deviceIds: ["dev-A"], cellId: "pA" }]);
    const started = scheduleTracks(state, ["lane-A"]);
    const resolver = started.effects[0];
    if (resolver.kind !== "resolveProtocolCode") throw new Error("expected resolver");
    const stopped = transition(started.state, { type: "STOP" });
    const resolved = transition(stopped.state, {
      type: "CODE_RESOLVED",
      effectId: resolver.effectId,
      trackId: resolver.trackId,
      cellId: resolver.cellId,
      code: [{ type: "scan" }],
      timings: TIMINGS,
    });
    expect(resolved.effects).toEqual([]);
    expect(resolved.state.inFlight).toEqual({});
    expect(resolved.state.cellRuns.pA?.status).toBe("interrupted");
  });

  it("keeps partial device failure completed and makes total failure track-local", () => {
    const { started, effects } = twoCommands();
    const partialResults = [
      { deviceId: "dev-A", data: { ok: true } },
      { deviceId: "dev-A-2", error: "lost" },
    ];
    let step = transition(started.state, {
      ...commandCompletion(effects[0]),
      deviceResults: partialResults,
      messages: ["dev-A-2: lost"],
    });
    step = transition(step.state, {
      type: "COMMAND_FAILED",
      effectId: effects[1].effectId,
      trackId: effects[1].trackId,
      cellId: effects[1].cellId,
      error: "all devices failed",
      deviceResults: [{ deviceId: "dev-B", error: "gone" }],
      messages: ["dev-B: gone"],
      timings: TIMINGS,
    });

    expect(step.state.cellRuns.cA?.status).toBe("completed");
    expect(step.state.outputs.cA).toEqual({
      v: { ok: "lane-A" },
      deviceResults: partialResults,
      messages: ["dev-A-2: lost"],
    });
    expect(step.state.tracks["lane-A"].status).toBe("active");
    expect(step.state.cellRuns.cB?.status).toBe("error");
    expect(step.state.outputs.cB?.deviceResults).toEqual([{ deviceId: "dev-B", error: "gone" }]);
    expect(step.state.tracks["lane-B"]).toMatchObject({
      status: "failed",
      terminalReason: "all devices failed",
    });
    // A terminal lane does not dominate aggregate status after siblings drain.
    expect(step.state.status).toBe("idle");
  });

  it("tracks two human interactions independently while running masks one", () => {
    const cells = [questionCell("qA", "A?"), commandCell("cA"), questionCell("qB", "B?")];
    let state = createInitialState({ cells, mode: "flow" });
    state = spawnTracks(state, [
      { id: "lane-A", laneId: "A", deviceIds: ["dev-A"], cellId: "qA" },
      { id: "lane-B", laneId: "B", deviceIds: ["dev-B"], cellId: "qB" },
    ]);
    let step = scheduleTracks(state, ["lane-B", "lane-A"]);
    expect(pendingTrackInteractions(step.state)).toEqual([
      { trackId: "lane-A", interaction: { kind: "question", cellId: "qA" } },
      { trackId: "lane-B", interaction: { kind: "question", cellId: "qB" } },
    ]);
    expect(step.state.status).toBe("awaitingInput");

    step = transition(step.state, {
      type: "ANSWER",
      trackId: "lane-A",
      cellId: "qA",
      value: "yes",
    });
    expect(step.state.status).toBe("running");
    expect(pendingTrackInteractions(step.state)).toEqual([
      { trackId: "lane-B", interaction: { kind: "question", cellId: "qB" } },
    ]);
  });

  it("reserves lane/container retry targets noisily", () => {
    const state = createInitialState({ cells: [commandCell("cA")], mode: "flow" });
    const result = transition(state, {
      type: "RETRY",
      target: { kind: "lane", trackId: "lane-A" },
    });
    expect(result.effects).toEqual([]);
    expect(result.state.trace[result.state.trace.length - 1]).toContain(
      "unsupported RETRY target lane",
    );
  });
});

describe("scheduler spine: device subsets", () => {
  const devices: DeviceRef[] = [
    { id: "dev-A", label: "A", family: "multispeq" },
    { id: "dev-B", label: "B", family: "ambit" },
  ];
  const cells: RunnerCell[] = [
    branchCell("bA", [
      {
        id: "path-A",
        goto: "cA",
        condition: { source: "$device", field: "family", operator: "eq", value: "multispeq" },
      },
    ]),
    commandCell("cA"),
    branchCell("bB", [
      {
        id: "path-B",
        goto: "cB",
        condition: { source: "$device", field: "family", operator: "eq", value: "ambit" },
      },
    ]),
    commandCell("cB"),
  ];

  it("scopes a device branch inside each track to that track's frozen subset", () => {
    let state = createInitialState({ cells, mode: "flow", devices });
    state = spawnTracks(state, [
      { id: "lane-B", laneId: "B", deviceIds: ["dev-B"], cellId: "bB" },
      { id: "lane-A", laneId: "A", deviceIds: ["dev-A"], cellId: "bA" },
    ]);
    const step = scheduleTracks(state, ["lane-B", "lane-A"]);
    const commands = step.effects.filter(
      (effect): effect is Extract<Effect, { kind: "runCommand" }> => effect.kind === "runCommand",
    );
    expect(
      commands.map((effect) => [effect.trackId, effect.cellId, effect.input.deviceIds]),
    ).toEqual([
      ["lane-A", "cA", ["dev-A"]],
      ["lane-B", "cB", ["dev-B"]],
    ]);
    expect(step.state.tracks["lane-A"].dispatch?.queue).toEqual([
      { targetCellId: "cA", deviceIds: ["dev-A"] },
    ]);
    expect(step.state.tracks["lane-B"].dispatch?.queue).toEqual([
      { targetCellId: "cB", deviceIds: ["dev-B"] },
    ]);
  });

  it("STOP completes the current dispatch group without launching the next group", () => {
    const state = createInitialState({ cells, mode: "notebook", devices });
    let step = transition(state, { type: "RUN_ALL" });
    const first = step.effects[0];
    if (first.kind !== "runCommand") throw new Error("expected command");
    step = transition(step.state, { type: "STOP" });
    step = transition(step.state, commandCompletion(first));
    expect(step.effects).toEqual([]);
    expect(step.state.tracks.main.dispatch).toBeNull();
    expect(step.state.cellRuns.cB).toBeUndefined();
  });
});
