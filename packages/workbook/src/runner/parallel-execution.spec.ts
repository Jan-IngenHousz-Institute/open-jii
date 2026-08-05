import { describe, expect, it } from "vitest";

import type {
  ParallelBodyCell,
  ParallelCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";

import { branchCell, commandCell, macroCell, questionCell } from "../demo/fixtures";
import type { Effect } from "./effects";
import { transition } from "./reducer";
import { parseSnapshot, toSnapshot } from "./snapshot";
import type { DeviceRef, RunnerState } from "./state";
import { createInitialState } from "./state";

const TIMINGS = { startedAt: 10, endedAt: 20 };

const devices: DeviceRef[] = [
  { id: "connection-a", label: "A", family: "multispeq" },
  { id: "connection-b", label: "B", family: "ambit" },
];

function condition(id: string, family: string) {
  return {
    id,
    sourceCellId: "$device",
    field: "family",
    operator: "eq" as const,
    value: family,
  };
}

function parallel(
  lanes: ParallelCell["lanes"],
  defaultLaneId = lanes[lanes.length - 1]?.id ?? "fallback",
): ParallelCell {
  return {
    id: "container",
    type: "parallel",
    name: "device lanes",
    defaultLaneId,
    isCollapsed: false,
    lanes,
  };
}

function commandEffects(effects: Effect[]) {
  return effects.filter(
    (effect): effect is Extract<Effect, { kind: "runCommand" }> => effect.kind === "runCommand",
  );
}

function completeCommand(
  state: RunnerState,
  effect: Extract<Effect, { kind: "runCommand" }>,
  deviceResults?: { deviceId: string; data?: unknown; error?: string }[],
) {
  return transition(state, {
    type: "COMMAND_DONE",
    effectId: effect.effectId,
    trackId: effect.trackId,
    cellId: effect.cellId,
    output: { from: effect.trackId },
    deviceResults,
    timings: TIMINGS,
  });
}

describe("parallel container execution", () => {
  it("enters a container from flow RUN_ALL", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "A",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("measure")],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    const step = transition(
      createInitialState({ cells: [container], mode: "flow", devices: [devices[0]] }),
      { type: "RUN_ALL" },
    );
    expect(commandEffects(step.effects).map((effect) => effect.cellId)).toEqual(["measure"]);
    expect(step.state.activeContainerAttemptId).toBe("container:1");
  });

  it("runs assigned lane bodies concurrently and releases the wait-all barrier", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "Multi",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("command-a")],
      },
      {
        id: "lane-b",
        label: "Ambit",
        color: "#00f",
        conditions: [condition("is-ambit", "ambit")],
        body: [commandCell("command-b")],
      },
    ]);
    const state = createInitialState({
      cells: [container, commandCell("after")],
      mode: "flow",
      devices,
    });
    let step = transition(state, { type: "START" });
    const started = commandEffects(step.effects);
    expect(started.map((effect) => [effect.cellId, effect.input.deviceIds])).toEqual([
      ["command-a", ["connection-a"]],
      ["command-b", ["connection-b"]],
    ]);

    step = completeCommand(step.state, started[1], [
      { deviceId: "connection-b", data: { ok: true } },
    ]);
    expect(step.effects).toEqual([]);
    expect(step.state.cellRuns.after).toBeUndefined();

    step = completeCommand(step.state, started[0], [
      { deviceId: "connection-a", data: { ok: true } },
    ]);
    const after = commandEffects(step.effects)[0];
    expect(after.cellId).toBe("after");
    expect(step.state.cellRuns.container?.status).toBe("completed");
    expect(step.state.activeContainerAttemptId).toBeNull();
    expect(step.state.parallelContexts.device_lanes?.lanes).toMatchObject({
      "lane-a": { status: "done" },
      "lane-b": { status: "done" },
    });
  });

  it("releases notebook RUN_ALL after its lane tracks finish", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "Multi",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("command-a")],
      },
      {
        id: "lane-b",
        label: "Ambit",
        color: "#00f",
        conditions: [condition("is-ambit", "ambit")],
        body: [commandCell("command-b")],
      },
    ]);
    let step = transition(
      createInitialState({
        cells: [container, commandCell("after")],
        mode: "notebook",
        devices,
      }),
      { type: "RUN_ALL" },
    );
    const started = commandEffects(step.effects);
    step = completeCommand(step.state, started[0], [
      { deviceId: "connection-a", data: { ok: true } },
    ]);
    step = completeCommand(step.state, started[1], [
      { deviceId: "connection-b", data: { ok: true } },
    ]);
    expect(commandEffects(step.effects)[0]?.cellId).toBe("after");
  });

  it("marks a mixed device lane partial and injects ctx.$parallel after the barrier", () => {
    const roster: DeviceRef[] = [
      { id: "connection-a1", label: "A1", family: "multispeq" },
      { id: "connection-a2", label: "A2", family: "multispeq" },
    ];
    const container = parallel([
      {
        id: "lane-a",
        label: "Measurements",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("measure")],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    let step = transition(
      createInitialState({
        cells: [container, macroCell("after-macro")],
        mode: "flow",
        devices: roster,
      }),
      { type: "START" },
    );
    const measure = commandEffects(step.effects)[0];
    step = completeCommand(step.state, measure, [
      { deviceId: "connection-a1", data: { value: 1 } },
      { deviceId: "connection-a2", error: "lost" },
    ]);

    expect(step.state.tracks[measure.trackId].status).toBe("partial");
    expect(step.state.parallelContexts.device_lanes?.lanes["lane-a"]).toEqual({
      label: "Measurements",
      status: "partial",
      devices: [
        { deviceId: "connection-a1", outcome: "ok" },
        { deviceId: "connection-a2", outcome: "failed" },
      ],
    });
    const macro = step.effects.find((effect) => effect.kind === "runMacro");
    if (!macro) throw new Error("expected post-container macro");
    const leg = macro.legs[0];
    if (leg.kind !== "run") throw new Error("expected macro run leg");
    expect(leg.input.ctx.ctx.$parallel).toEqual(step.state.parallelContexts);
  });

  it("publishes a branchable producer output keyed by the container cell id", () => {
    const roster: DeviceRef[] = [
      { id: "connection-a1", label: "A1", family: "multispeq" },
      { id: "connection-a2", label: "A2", family: "multispeq" },
    ];
    const container = parallel([
      {
        id: "lane-a",
        label: "Measurements",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("measure")],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    const after = branchCell(
      "after-branch",
      [
        {
          id: "partial-path",
          goto: "recover",
          condition: {
            source: "container",
            field: "lane-a",
            operator: "eq",
            value: "partial",
          },
        },
        { id: "healthy-path", goto: "healthy" },
      ],
      "healthy-path",
    );
    let step = transition(
      createInitialState({
        cells: [container, after, commandCell("recover"), commandCell("healthy")],
        mode: "flow",
        devices: roster,
      }),
      { type: "START" },
    );
    const measure = commandEffects(step.effects)[0];
    step = completeCommand(step.state, measure, [
      { deviceId: "connection-a1", data: { value: 1 } },
      { deviceId: "connection-a2", error: "lost" },
    ]);

    expect(step.state.outputs.container?.v).toMatchObject({
      "lane-a": "partial",
      fallback: "skipped",
      lanes: { "lane-a": { status: "partial" }, fallback: { status: "skipped" } },
    });
    expect(commandEffects(step.effects)[0]?.cellId).toBe("recover");
  });

  it("abandons a lane waiting on a question and releases the barrier", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "Needs input",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [questionCell("lane-question", "Continue?") as ParallelBodyCell],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    let step = transition(
      createInitialState({
        cells: [container, commandCell("after")],
        mode: "flow",
        devices: [devices[0]],
      }),
      { type: "START" },
    );
    const trackId = Object.keys(step.state.tracks).find((id) => id !== "main");
    if (!trackId) throw new Error("expected lane track");
    expect(step.state.tracks[trackId].pendingInteraction?.kind).toBe("question");

    step = transition(step.state, { type: "ABANDON_LANE", trackId });
    expect(step.state.tracks[trackId]).toMatchObject({
      status: "skipped",
      terminalReason: "Abandoned by researcher",
    });
    expect(commandEffects(step.effects)[0]?.cellId).toBe("after");
    expect(step.state.parallelContexts.device_lanes?.lanes["lane-a"].status).toBe("skipped");
  });

  it("STOP terminalizes an idle attempt waiting on a lane question", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "Needs input",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [questionCell("lane-question", "Continue?") as ParallelBodyCell],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    let step = transition(
      createInitialState({ cells: [container], mode: "flow", devices: [devices[0]] }),
      { type: "START" },
    );
    expect(
      Object.values(step.state.tracks).map((track) => track.pendingInteraction),
    ).toContainEqual({ kind: "question", cellId: "lane-question" });

    step = transition(step.state, { type: "STOP" });

    expect(step.state.activeContainerAttemptId).toBeNull();
    expect(step.state.cellRuns.container?.status).toBe("cancelled");
    expect(step.state.parallelContexts.device_lanes?.lanes["lane-a"].status).toBe("skipped");
  });

  it("cancels owned device work before an in-flight lane becomes skipped", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "Measurement",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("measure")],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    let step = transition(
      createInitialState({
        cells: [container, commandCell("after")],
        mode: "flow",
        devices: [devices[0]],
      }),
      { type: "START" },
    );
    const measure = commandEffects(step.effects)[0];
    step = transition(step.state, { type: "ABANDON_LANE", trackId: measure.trackId });
    expect(step.effects).toEqual([{ kind: "cancelEffects", effectIds: [measure.effectId] }]);
    expect(step.state.status).toBe("cancelling");

    step = transition(step.state, {
      type: "EFFECT_CANCELLED",
      effectId: measure.effectId,
      trackId: measure.trackId,
      cellId: measure.cellId,
    });
    expect(step.state.tracks[measure.trackId].status).toBe("skipped");
    expect(commandEffects(step.effects)[0]?.cellId).toBe("after");
  });

  it("discards every nested value before a restored attempt can be confirmed", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "A",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("command-a")],
      },
      {
        id: "lane-b",
        label: "B",
        color: "#00f",
        conditions: [condition("is-ambit", "ambit")],
        body: [commandCell("command-b")],
      },
    ]);
    let step = transition(createInitialState({ cells: [container], mode: "flow", devices }), {
      type: "START",
    });
    const started = commandEffects(step.effects);
    step = completeCommand(step.state, started[0], [
      { deviceId: "connection-a", data: { attempt: 1 } },
    ]);
    expect(step.state.outputs["command-a"]).toBeDefined();

    const snapshot = parseSnapshot(toSnapshot(step.state, 123));
    expect(snapshot.state.outputs["command-a"]).toBeUndefined();
    expect(snapshot.state.cellRuns["command-a"]).toBeUndefined();
    expect(snapshot.state.tracks.main.pendingInteraction).toEqual({
      kind: "restart",
      cellId: "container",
    });
    const attemptId = snapshot.state.activeContainerAttemptId;
    if (!attemptId) throw new Error("expected parked attempt");

    let resumed = transition(snapshot.state as RunnerState, { type: "SET_DEVICES", devices });
    resumed = transition(resumed.state, {
      type: "RETRY",
      target: { kind: "containerAttempt", containerCellId: "container", attemptId },
    });
    expect(commandEffects(resumed.effects).map((effect) => effect.cellId)).toEqual([
      "command-a",
      "command-b",
    ]);
    expect(resumed.state.outputs["command-a"]).toBeUndefined();
  });

  it("purges attempt one before a backward branch re-enters the container", () => {
    const container = parallel([
      {
        id: "lane-a",
        label: "A",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [commandCell("measure")],
      },
      {
        id: "fallback",
        label: "Fallback",
        color: "#999",
        conditions: [],
        body: [commandCell("unused")],
      },
    ]);
    const loop = {
      id: "loop",
      type: "branch" as const,
      isCollapsed: false,
      defaultPathId: "again",
      paths: [
        {
          id: "again",
          label: "Again",
          color: "#f00",
          conditions: [],
          gotoCellId: "container",
        },
      ],
    };
    let step = transition(
      createInitialState({ cells: [container, loop], mode: "flow", devices: [devices[0]] }),
      { type: "START" },
    );
    const first = commandEffects(step.effects)[0];
    step = completeCommand(step.state, first, [{ deviceId: "connection-a", data: { attempt: 1 } }]);

    const second = commandEffects(step.effects)[0];
    expect(second.cellId).toBe("measure");
    expect(second.effectId).not.toBe(first.effectId);
    expect(step.state.containerAttemptSeq).toBe(2);
    expect(step.state.outputs.measure).toBeUndefined();
    expect(step.state.cellRuns.measure?.status).toBe("running");
  });

  it.each(["STOP", "CANCEL"] as const)(
    "%s terminalizes an active attempt so the next RUN_ALL starts fresh",
    (verb) => {
      const container = parallel([
        {
          id: "lane-a",
          label: "A",
          color: "#f00",
          conditions: [condition("is-multi", "multispeq")],
          body: [commandCell("measure"), commandCell("later")],
        },
        {
          id: "fallback",
          label: "Fallback",
          color: "#999",
          conditions: [],
          body: [commandCell("unused")],
        },
      ]);
      let step = transition(
        createInitialState({ cells: [container], mode: "notebook", devices: [devices[0]] }),
        { type: "RUN_ALL" },
      );
      const first = commandEffects(step.effects)[0];
      step = transition(step.state, { type: verb });
      step =
        verb === "CANCEL"
          ? transition(step.state, {
              type: "EFFECT_CANCELLED",
              effectId: first.effectId,
              trackId: first.trackId,
              cellId: first.cellId,
            })
          : completeCommand(step.state, first, [
              { deviceId: "connection-a", data: { attempt: 1 } },
            ]);
      expect(step.state.activeContainerAttemptId).toBeNull();
      expect(step.state.status).not.toBe("fatal");

      const restarted = transition(step.state, { type: "RUN_ALL" });
      expect(commandEffects(restarted.effects).map((effect) => effect.cellId)).toEqual(["measure"]);
      expect(restarted.state.status).not.toBe("fatal");
    },
  );

  it("regroups a device branch against only its lane's frozen subset", () => {
    const laneABranch = branchCell("branch-a", [
      {
        id: "multi-target",
        goto: "command-a",
        condition: { source: "$device", field: "family", operator: "eq", value: "multispeq" },
      },
    ]) as ParallelBodyCell;
    const laneBBranch = branchCell("branch-b", [
      {
        id: "ambit-target",
        goto: "command-b",
        condition: { source: "$device", field: "family", operator: "eq", value: "ambit" },
      },
    ]) as ParallelBodyCell;
    const container = parallel([
      {
        id: "lane-a",
        label: "A",
        color: "#f00",
        conditions: [condition("is-multi", "multispeq")],
        body: [laneABranch, commandCell("command-a")],
      },
      {
        id: "lane-b",
        label: "B",
        color: "#00f",
        conditions: [condition("is-ambit", "ambit")],
        body: [laneBBranch, commandCell("command-b")],
      },
    ]);
    const step = transition(createInitialState({ cells: [container], mode: "flow", devices }), {
      type: "START",
    });
    expect(
      commandEffects(step.effects).map((effect) => [effect.cellId, effect.input.deviceIds]),
    ).toEqual([
      ["command-a", ["connection-a"]],
      ["command-b", ["connection-b"]],
    ]);
  });
});
