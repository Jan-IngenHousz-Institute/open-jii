import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import { branchCell, commandCell as cmd, macroCell as macro } from "../demo/fixtures";
import { createMacroRunner, waitFor } from "../demo/simulators";
import type { CommandExecutorPort, DeviceOutcome } from "../ports";
import type { Effect } from "./effects";
import { mergeCellsView } from "./host-view";
import { transition } from "./reducer";
import type { CreateStateOptions, DeviceRef, RunnerState } from "./state";
import { createInitialState } from "./state";
import { WorkbookRunner } from "./workbook-runner";

const TIMINGS = { startedAt: 0, endedAt: 5 };

const DEVICES: DeviceRef[] = [
  { id: "dev-1", label: "Device #1", family: "multispeq", deviceName: "MultispeQ v2" },
  { id: "dev-2", label: "Device #2", family: "ambit", deviceName: "Ambit" },
  { id: "dev-3", label: "Device #3", family: "multispeq" },
];

function init(cells: RunnerCell[], opts: Partial<CreateStateOptions> = {}): RunnerState {
  return createInitialState({ cells, mode: "notebook", devices: DEVICES, ...opts });
}

interface Step {
  state: RunnerState;
  effects: Effect[];
}

function onlyInFlight(state: RunnerState) {
  const entries = Object.values(state.inFlight).filter((entry) => entry !== undefined);
  if (entries.length !== 1) throw new Error(`expected one in-flight effect, got ${entries.length}`);
  return entries[0];
}

function commandDone(
  state: RunnerState,
  output: unknown,
  extra: { deviceResults?: DeviceOutcome[]; messages?: string[] } = {},
): Step {
  const inFlight = onlyInFlight(state);
  return transition(state, {
    type: "COMMAND_DONE",
    effectId: inFlight.effectId,
    trackId: inFlight.trackId,
    cellId: inFlight.cellId,
    output,
    ...extra,
    timings: TIMINGS,
  });
}

function commandDoneFor(
  state: RunnerState,
  cellId: string,
  output: unknown,
  extra: { deviceResults?: DeviceOutcome[]; messages?: string[] } = {},
): Step {
  const inFlight = Object.values(state.inFlight).find((entry) => entry?.cellId === cellId);
  if (!inFlight) throw new Error(`expected an in-flight effect for ${cellId}`);
  return transition(state, {
    type: "COMMAND_DONE",
    effectId: inFlight.effectId,
    trackId: inFlight.trackId,
    cellId: inFlight.cellId,
    output,
    ...extra,
    timings: TIMINGS,
  });
}

describe("multi-device outputs", () => {
  it("stores deviceResults and partial-failure messages on the output entry", () => {
    let step = transition(init([cmd("c1")]), { type: "RUN_CELL", cellId: "c1" });
    const deviceResults: DeviceOutcome[] = [
      { deviceId: "dev-1", deviceLabel: "Device #1", family: "multispeq", data: { a: 1 } },
      { deviceId: "dev-2", deviceLabel: "Device #2", family: "ambit", error: "boom" },
    ];
    step = commandDone(step.state, { a: 1 }, { deviceResults, messages: ["Device #2: boom"] });

    expect(step.state.cellRuns.c1?.status).toBe("completed");
    expect(step.state.outputs.c1).toEqual({
      v: { a: 1 },
      deviceResults,
      messages: ["Device #2: boom"],
    });

    const merged = mergeCellsView(step.state.cells, step.state);
    const output = merged.find((c) => c.type === "output" && c.producedBy === "c1");
    if (output?.type !== "output") throw new Error("expected output cell");
    expect(output.deviceResults).toBe(deviceResults);
    expect(output.messages).toEqual(["Device #2: boom"]);
  });

  it("keeps per-device errors on the entry when every device fails", () => {
    let step = transition(init([cmd("c1")]), { type: "RUN_CELL", cellId: "c1" });
    const deviceResults: DeviceOutcome[] = [
      { deviceId: "dev-1", deviceLabel: "Device #1", error: "boom-1" },
      { deviceId: "dev-2", deviceLabel: "Device #2", error: "boom-2" },
    ];
    const inFlight = onlyInFlight(step.state);
    step = transition(step.state, {
      type: "COMMAND_FAILED",
      effectId: inFlight.effectId,
      trackId: inFlight.trackId,
      cellId: "c1",
      error: "boom-1",
      deviceResults,
      messages: ["Device #1: boom-1", "Device #2: boom-2"],
      timings: TIMINGS,
    });

    expect(step.state.cellRuns.c1?.status).toBe("error");
    expect(step.state.cellRuns.c1?.error).toBe("boom-1");
    expect(step.state.outputs.c1?.deviceResults).toBe(deviceResults);

    const merged = mergeCellsView(step.state.cells, step.state);
    const output = merged.find((c) => c.type === "output" && c.producedBy === "c1");
    if (output?.type !== "output") throw new Error("expected output cell");
    expect(output.messages).toEqual(["Device #1: boom-1", "Device #2: boom-2"]);
  });
});

describe("macro fan-out legs", () => {
  it("builds one leg per upstream device, carrying failed measurements through", () => {
    let state = init([cmd("c1"), macro("a1")]);
    state = {
      ...state,
      outputs: {
        c1: {
          v: { v: 1 },
          deviceResults: [
            { deviceId: "dev-1", deviceLabel: "Device #1", family: "multispeq", data: { v: 1 } },
            { deviceId: "dev-2", deviceLabel: "Device #2", family: "ambit", error: "boom" },
            { deviceId: "dev-3", deviceLabel: "Device #3", family: "multispeq", data: { v: 3 } },
          ],
        },
      },
    };
    const step = transition(state, { type: "RUN_CELL", cellId: "a1" });
    const effect = step.effects[0];
    if (effect.kind !== "runMacro") throw new Error("expected runMacro");

    expect(effect.legs).toHaveLength(3);
    const [leg1, leg2, leg3] = effect.legs;
    if (leg1.kind !== "run" || leg3.kind !== "run" || leg2.kind !== "carriedFailure") {
      throw new Error("unexpected leg kinds");
    }
    expect(leg1.input.deviceId).toBe("dev-1");
    expect(leg1.input.json).toEqual({ v: 1 });
    // The upstream cell reports its own error; the leg carries the generic message.
    expect(leg2.outcome.error).toBe("No measurement data from this device");
    expect(leg3.input.json).toEqual({ v: 3 });

    // Each leg's ctx is scoped to ITS device: value + $device identity.
    const ctx1 = leg1.input.ctx.ctx as Record<string, Record<string, unknown>>;
    const ctx3 = leg3.input.ctx.ctx as Record<string, Record<string, unknown>>;
    expect(ctx1.c1).toEqual({ v: 1 });
    expect(ctx3.c1).toEqual({ v: 3 });
    expect(ctx1.$device).toMatchObject({ family: "multispeq", index: 0 });
    expect(ctx3.$device).toMatchObject({ family: "multispeq", index: 2 });
  });

  it("runs legs serially through the port and aggregates per-device results", async () => {
    const executor: CommandExecutorPort = {
      execute: () =>
        Promise.resolve([
          { deviceId: "dev-1", deviceLabel: "Device #1", data: { v: 1 } },
          { deviceId: "dev-2", deviceLabel: "Device #2", data: { v: 2 } },
        ]),
    };
    const macroId = "5f1f9c1a-2c1e-4f6a-9d1b-00000000cc10";
    const runner = new WorkbookRunner({
      cells: [cmd("c1"), macro("a1", macroId)],
      mode: "notebook",
      devices: DEVICES.slice(0, 2),
      ports: {
        commandExecutor: executor,
        macroRunner: createMacroRunner({
          [macroId]: (json) => ({ phi: (json as { v: number }).v * 2 }),
        }),
      },
    });
    runner.send({ type: "RUN_CELL", cellId: "c1" });
    await waitFor(runner, (s) => s.cellRuns.c1?.status === "completed", "command done");
    runner.send({ type: "RUN_CELL", cellId: "a1" });
    const done = await waitFor(runner, (s) => s.cellRuns.a1?.status === "completed", "macro done");

    expect(done.outputs.a1?.v).toEqual({ phi: 2 });
    expect(done.outputs.a1?.deviceResults).toEqual([
      {
        deviceId: "dev-1",
        deviceLabel: "Device #1",
        family: undefined,
        deviceName: undefined,
        data: { phi: 2 },
      },
      {
        deviceId: "dev-2",
        deviceLabel: "Device #2",
        family: undefined,
        deviceName: undefined,
        data: { phi: 4 },
      },
    ]);
  });
});

describe("device dispatch branch", () => {
  const dispatchCells = (): RunnerCell[] => [
    branchCell("b1", [
      {
        id: "p1",
        goto: "c1",
        condition: { source: "$device", field: "family", operator: "eq", value: "multispeq" },
      },
      {
        id: "p2",
        goto: "c2",
        condition: { source: "$device", field: "family", operator: "eq", value: "ambit" },
      },
    ]),
    cmd("c1", "battery"),
    cmd("c2", "READ"),
  ];

  it("groups devices by path, runs every target concurrently against its subset, then skips them", () => {
    let step = transition(init(dispatchCells()), { type: "RUN_ALL" });

    // Both heterogeneous targets launch in the same reducer turn.
    const first = step.effects[0];
    const second = step.effects[1];
    if (first.kind !== "runCommand") throw new Error("expected runCommand");
    if (second.kind !== "runCommand") throw new Error("expected runCommand");
    expect(first.cellId).toBe("c1");
    expect(first.input.deviceIds).toEqual(["dev-1", "dev-3"]);
    expect(second.cellId).toBe("c2");
    expect(second.input.deviceIds).toEqual(["dev-2"]);
    expect(step.state.outputs.b1?.messages).toEqual([
      "p1 -> Device #1, Device #3",
      "p2 -> Device #2",
    ]);
    step = commandDoneFor(step.state, "c1", { battery: 82 });
    expect(step.effects).toEqual([]);
    step = commandDoneFor(step.state, "c2", { par: 1500 });

    // Queue done: the walk continues after the branch and skips both consumed
    // targets exactly once instead of re-running them.
    expect(step.state.status).toBe("idle");
    expect(step.state.tracks.main.dispatch).toBeNull();
    expect(step.state.tracks.main.dispatchConsumed).toEqual({});
    expect(step.state.cellRuns.c1?.status).toBe("completed");
    expect(step.state.cellRuns.c2?.status).toBe("completed");
    expect(step.state.cellRuns.b1?.status).toBe("completed");
    expect(step.state.cellRuns.b1?.lastMatchedPathId).toBeUndefined();
    expect(step.state.outputs.c1).toEqual({
      v: { battery: 82 },
      deviceResults: undefined,
      messages: undefined,
    });
  });

  it("launches heterogeneous target groups concurrently", () => {
    const calls: { cellId: string; deviceIds: string[] }[] = [];
    const executor: CommandExecutorPort = {
      execute: (input) => {
        calls.push({ cellId: input.cellId, deviceIds: input.deviceIds });
        return new Promise<DeviceOutcome[]>(() => undefined);
      },
    };
    const runner = new WorkbookRunner({
      cells: dispatchCells(),
      mode: "notebook",
      devices: DEVICES,
      ports: { commandExecutor: executor, macroRunner: createMacroRunner({}) },
    });

    runner.send({ type: "RUN_ALL" });

    expect(calls).toEqual([
      { cellId: "c1", deviceIds: ["dev-1", "dev-3"] },
      { cellId: "c2", deviceIds: ["dev-2"] },
    ]);
    runner.dispose();
  });

  it("coalesces dispatch paths that converge on the same command cell", () => {
    const cells: RunnerCell[] = [
      branchCell("b1", [
        {
          id: "p1",
          goto: "c1",
          condition: { source: "$device", field: "family", operator: "eq", value: "multispeq" },
        },
        {
          id: "p2",
          goto: "c1",
          condition: { source: "$device", field: "family", operator: "eq", value: "ambit" },
        },
      ]),
      cmd("c1"),
    ];

    const step = transition(init(cells), { type: "RUN_ALL" });
    expect(step.effects).toHaveLength(1);
    const effect = step.effects[0];
    if (effect.kind !== "runCommand") throw new Error("expected runCommand");
    expect(effect.input.deviceIds).toEqual(["dev-1", "dev-3", "dev-2"]);
    expect(Object.values(step.state.inFlight)).toHaveLength(1);
  });

  it("lists devices matching no path as skipped, never as an error", () => {
    const cells: RunnerCell[] = [
      branchCell("b1", [
        {
          id: "p1",
          goto: "c1",
          condition: { source: "$device", field: "family", operator: "eq", value: "multispeq" },
        },
      ]),
      cmd("c1"),
    ];
    let step = transition(init(cells), { type: "RUN_ALL" });
    expect(step.state.outputs.b1?.messages).toEqual([
      "p1 -> Device #1, Device #3",
      "Device #2 (ambit): no measurement resolved this round",
    ]);
    step = commandDone(step.state, { ok: true });
    expect(step.state.status).toBe("idle");
    expect(step.state.cellRuns.b1?.status).toBe("completed");
  });

  it("fails the branch when no device is connected", () => {
    const step = transition(init(dispatchCells(), { devices: [] }), { type: "RUN_ALL" });
    expect(step.state.cellRuns.b1?.status).toBe("error");
    expect(step.state.cellRuns.b1?.error).toContain("No device connected");
  });

  it("a failing target advances the queue instead of halting the other groups", () => {
    let step = transition(init(dispatchCells()), { type: "RUN_ALL" });
    const inFlight = Object.values(step.state.inFlight).find((entry) => entry?.cellId === "c1");
    if (!inFlight) throw new Error("expected c1 in flight");
    step = transition(step.state, {
      type: "COMMAND_FAILED",
      effectId: inFlight.effectId,
      trackId: inFlight.trackId,
      cellId: "c1",
      error: "boom",
      timings: TIMINGS,
    });
    // c1 failed; the already-running c2 group remains unaffected.
    expect(step.effects).toEqual([]);
    step = commandDoneFor(step.state, "c2", { par: 1500 });
    expect(step.state.cellRuns.c1?.status).toBe("error");
    expect(step.state.cellRuns.c2?.status).toBe("completed");
    expect(step.state.status).toBe("idle");
  });

  it("retries a cancelled dispatch target with its original subset and remaining queue", () => {
    let step = transition(init(dispatchCells()), { type: "RUN_ALL" });
    const first = step.effects[0];
    const second = step.effects[1];
    if (first.kind !== "runCommand") throw new Error("expected runCommand");
    if (second.kind !== "runCommand") throw new Error("expected runCommand");
    expect(first.input.deviceIds).toEqual(["dev-1", "dev-3"]);

    step = transition(step.state, { type: "CANCEL" });
    step = transition(step.state, {
      type: "EFFECT_CANCELLED",
      effectId: first.effectId,
      trackId: first.trackId,
      cellId: first.cellId,
    });
    step = transition(step.state, {
      type: "EFFECT_CANCELLED",
      effectId: second.effectId,
      trackId: second.trackId,
      cellId: second.cellId,
    });
    expect(step.state.tracks.main.dispatch).toMatchObject({ index: 0 });

    step = transition(step.state, {
      type: "RETRY",
      target: { kind: "postCancel", trackId: "main", cellId: "c1" },
    });
    const retried = step.effects[0];
    const remaining = step.effects[1];
    if (retried.kind !== "runCommand") throw new Error("expected retried runCommand");
    if (remaining.kind !== "runCommand") throw new Error("expected remaining runCommand");
    expect(retried.input.deviceIds).toEqual(["dev-1", "dev-3"]);
    expect(remaining.cellId).toBe("c2");
    expect(remaining.input.deviceIds).toEqual(["dev-2"]);
  });
});

describe("SET_DEVICES", () => {
  it("replaces the roster without touching anything else", () => {
    const state = init([cmd("c1")]);
    const step = transition(state, { type: "SET_DEVICES", devices: DEVICES.slice(0, 1) });
    expect(step.state.devices).toEqual(DEVICES.slice(0, 1));
    expect(step.effects).toEqual([]);
    expect(step.state.status).toBe(state.status);
  });
});
