import { describe, expect, it } from "vitest";

import type { CellNamespace } from "@repo/api/transforms/build-cell-namespace";

import type { RunnerCell } from "../cells";
import { commandCell, markdownCell } from "../demo/fixtures";
import { createSamplePorts, sampleWorkbook, scanAttempts } from "../demo/sample-workbook";
import {
  createManualExecutor,
  createMemoryOutputStore,
  createSimulatedExecutor,
  FakeClock,
  waitFor,
} from "../demo/simulators";
import type { CommandProgress, CommandRunInput } from "../ports";
import { SnapshotError } from "./snapshot";
import type { RunnerState } from "./state";
import type { WorkbookRunnerOptions, WorkbookRunnerPorts } from "./workbook-runner";
import { WorkbookRunner } from "./workbook-runner";

interface SampleRunner {
  runner: WorkbookRunner;
  allCalls: CommandRunInput[];
  macroInputs: { json: unknown; ctx: CellNamespace }[];
  clock: FakeClock;
}

/** Sample workbook wired to simulators; scans served from `attempts` in order. */
function makeSampleRunner(
  attempts: Record<string, unknown>[] = scanAttempts,
  options: Partial<WorkbookRunnerOptions> = {},
): SampleRunner {
  const clock = new FakeClock();
  const macroInputs: { json: unknown; ctx: CellNamespace }[] = [];
  const { ports, executor } = createSamplePorts(attempts, {
    clock,
    onMacroInput: (json, ctx) => macroInputs.push({ json, ctx }),
  });
  const runner = new WorkbookRunner({ cells: sampleWorkbook, ports, ...options });
  return { runner, allCalls: executor.calls, macroInputs, clock };
}

async function runSampleToDone(sample: SampleRunner): Promise<Readonly<RunnerState>> {
  const { runner } = sample;
  runner.start();
  runner.send({ type: "NEXT" });
  runner.send({ type: "ANSWER", trackId: "main", cellId: "q_sunlight", value: "yes" });
  await waitFor(runner, (s) => s.tracks.main.cursor.cellId === "md_done", "md_done");
  runner.send({ type: "NEXT" });
  return waitFor(runner, (s) => s.status === "done", "done");
}

describe("WorkbookRunner: spike scenarios", () => {
  it("runs a good reading to done: outputs, macro ctx, tagged artifact, answers", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    const state = await runSampleToDone(sample);
    expect(state.tracks.main.branchVisits.branch_quality).toBe(1);
    expect(sample.allCalls.filter((c) => c.source.kind === "protocolCell")).toHaveLength(1);
    expect(Object.keys(state.outputs).sort()).toEqual([
      "cmd_battery",
      "macro_construct",
      "macro_phi2",
      "proto_psii",
    ]);
    // Macros read the verbatim upstream scan and the ctx namespace.
    const input = sample.macroInputs[0];
    expect(input.json).toEqual(scanAttempts[1]);
    expect(input.ctx.ctx.measured_in_sunlight).toEqual({ answer: "yes" });
    expect(state.outputs.macro_phi2?.v).toEqual({ Phi2: 0.747, sunlit: true, samples: 3 });
    // Current web records deviceResults even for one device, so tagged macro
    // output remains ordinary data. Amber's parser stays available for #1718,
    // but `deviceResults === undefined` must not be treated as a single-device
    // predicate when that gated capability is eventually enabled.
    expect(sample.allCalls.some((c) => c.source.kind === "artifact")).toBe(false);
    expect(state.outputs.macro_construct?.v).toMatchObject({
      __ojArtifact: "protocol",
      version: 1,
    });
    expect(state.outputs.macro_construct?.deviceResults).toHaveLength(1);
    // Answers and command outputs accumulate in context.
    expect(state.answersByCycle[0]).toEqual({ q_sunlight: "yes" });
    expect(state.outputs.cmd_battery?.v).toBe("82%");
  });

  it("loops back and remeasures on a noisy first reading", async () => {
    const sample = makeSampleRunner();
    const state = await runSampleToDone(sample);
    expect(state.tracks.main.branchVisits.branch_quality).toBe(2);
    expect(sample.allCalls.filter((c) => c.source.kind === "protocolCell")).toHaveLength(2);
    expect(state.cellRuns.macro_phi2?.executionOrder).toHaveLength(2);
    expect(state.outputs.macro_phi2?.v).toEqual({ Phi2: 0.747, sunlit: true, samples: 3 });
  });

  it("survives a JSON snapshot round-trip mid-flow and resumes to done", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    sample.runner.start();
    sample.runner.send({ type: "NEXT" });
    expect(sample.runner.getState().tracks.main.cursor.cellId).toBe("q_sunlight");
    // An ANSWER targeting a different cell is ignored outright.
    sample.runner.send({ type: "ANSWER", trackId: "main", cellId: "md_done", value: "nope" });
    expect(sample.runner.getState().tracks.main.cursor.cellId).toBe("q_sunlight");
    expect(sample.runner.getState().answersByCycle[0]).toEqual({});

    const snapshot: unknown = JSON.parse(JSON.stringify(sample.runner.snapshot()));
    const revived = makeSampleRunner([scanAttempts[1]]);
    const restored = await WorkbookRunner.restore(
      snapshot,
      createSamplePorts([scanAttempts[1]], { clock: revived.clock }).ports,
    );
    expect(restored.getState().tracks.main.cursor.cellId).toBe("q_sunlight");
    restored.send({ type: "ANSWER", trackId: "main", cellId: "q_sunlight", value: "yes" });
    await waitFor(restored, (s) => s.tracks.main.cursor.cellId === "md_done", "md_done");
    restored.send({ type: "NEXT" });
    const state = await waitFor(restored, (s) => s.status === "done", "done");
    expect(state.answersByCycle[0]).toEqual({ q_sunlight: "yes" });
  });
});

const battery: RunnerCell[] = [commandCell("c1"), markdownCell("m1", "end")];

function basePorts(overrides: Partial<WorkbookRunnerPorts> = {}): WorkbookRunnerPorts {
  const { ports } = createSamplePorts();
  return {
    ...ports,
    commandExecutor: createSimulatedExecutor(),
    clock: new FakeClock(),
    ...overrides,
  };
}

it("can preserve the mobile inline-command Continue interaction as an explicit host policy", async () => {
  const runner = new WorkbookRunner({
    cells: battery,
    ports: basePorts(),
    mode: "flow",
    pauseAfterInlineCommand: true,
  });
  runner.start();
  await waitFor(
    runner,
    (state) => state.tracks.main.pendingInteraction?.cellId === "c1",
    "inline command continue",
  );
  expect(runner.getState().tracks.main).toMatchObject({
    status: "awaitingHuman",
    cursor: { cellId: "c1" },
    pendingInteraction: { kind: "instruction", cellId: "c1" },
  });
  runner.send({ type: "NEXT" });
  expect(runner.getState().tracks.main.cursor.cellId).toBe("m1");
});

/** Battery workbook wired to a manually-settled executor. */
function manualRunner() {
  const manual = createManualExecutor();
  const runner = new WorkbookRunner({
    cells: battery,
    ports: basePorts({ commandExecutor: manual }),
  });
  return { manual, runner };
}

describe("WorkbookRunner: driver behavior", () => {
  it("streams progress into state and clears it on completion", async () => {
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({ commandExecutor: createSimulatedExecutor({ progressTicks: 3 }) }),
    });
    const seen: CommandProgress[] = [];
    runner.subscribe((s) => {
      if (s.tracks.main.progress) seen.push(s.tracks.main.progress);
    });
    runner.start();
    await waitFor(runner, (s) => s.tracks.main.cursor.cellId === "m1", "m1");
    expect(seen.map((p) => p.phase)).toEqual(["sent", "receiving", "receiving", "receiving"]);
    expect(seen[3].chunks).toBe(3);
    expect(runner.getState().tracks.main.progress).toBeNull();
  });

  it("cancel aborts the signal, discards the late result, and RETRY recovers", async () => {
    const { manual, runner } = manualRunner();
    runner.start();
    await waitFor(runner, (s) => s.status === "running", "running");
    const pending = manual.pending.shift();
    if (!pending) throw new Error("no pending command");
    runner.cancel();
    const cancelled = await waitFor(runner, (s) => s.status === "awaitingInput", "re-armed");
    expect(pending.signal.aborted).toBe(true);
    expect(cancelled.cellRuns.c1?.status).toBe("cancelled");
    // The device answers anyway: nothing may record.
    pending.resolve([
      { deviceId: "sim-device", deviceLabel: "Simulator", data: { phantom: true } },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(runner.getState().outputs).toEqual({});
    runner.send({
      type: "RETRY",
      target: { kind: "postCancel", trackId: "main", cellId: "c1" },
    });
    await waitFor(runner, (s) => s.status === "running", "running again");
    manual.settle("82%");
    const done = await waitFor(runner, (s) => s.cellRuns.c1?.status === "completed", "completed");
    expect(done.outputs.c1?.v).toBe("82%");
  });

  it("snapshot taken mid-command re-arms the cell as interrupted", async () => {
    const { runner } = manualRunner();
    runner.start();
    await waitFor(runner, (s) => s.status === "running", "running");
    const snapshot = runner.snapshot();
    expect(snapshot.state.status).toBe("awaitingInput");
    expect(snapshot.state.cellRuns.c1?.status).toBe("interrupted");
    expect(snapshot.state.inFlight).toEqual({});

    const restored = await WorkbookRunner.restore(
      JSON.parse(JSON.stringify(snapshot)),
      basePorts(),
    );
    expect(restored.getState().status).toBe("awaitingInput");
    restored.send({
      type: "RETRY",
      target: { kind: "postCancel", trackId: "main", cellId: "c1" },
    });
    const done = await waitFor(restored, (s) => s.cellRuns.c1?.status === "completed", "done");
    expect(done.outputs.c1?.v).toEqual({ echoed: "battery" });
  });

  it("offloads large outputs to the store and inflates them on restore", async () => {
    const store = createMemoryOutputStore();
    const big = { blob: "x".repeat(300_000) };
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({
        commandExecutor: createSimulatedExecutor({ respond: () => big }),
        outputStore: store,
      }),
    });
    runner.start();
    await waitFor(runner, (s) => s.tracks.main.cursor.cellId === "m1", "m1");

    const snapshot = await runner.snapshotOffloaded();
    const entry = snapshot.state.outputs.c1;
    if (!("ref" in entry)) throw new Error("expected a ref entry");
    expect(JSON.stringify(snapshot).length).toBeLessThan(20_000);

    const restored = await WorkbookRunner.restore(JSON.parse(JSON.stringify(snapshot)), {
      ...basePorts(),
      outputStore: store,
    });
    expect(restored.getState().outputs.c1?.v).toEqual(big);
    expect(restored.getState().outputs.c1?.deviceResults?.[0]?.data).toEqual(big);
  });

  it("restore rejects tampered cells, storeless offloads, corrupt and future snapshots", async () => {
    await expect(WorkbookRunner.restore("garbage", basePorts())).rejects.toBeInstanceOf(
      SnapshotError,
    );
    await expect(WorkbookRunner.restore({ schemaVersion: 999 }, basePorts())).rejects.toMatchObject(
      { code: "unsupportedVersion" },
    );

    const runner = new WorkbookRunner({ cells: battery, ports: basePorts() });
    runner.start();
    await waitFor(runner, (s) => s.tracks.main.cursor.cellId === "m1", "m1");

    const tampered = JSON.parse(JSON.stringify(runner.snapshot())) as {
      state: { cells: { content?: string }[] };
    };
    tampered.state.cells[1].content = "edited";
    await expect(WorkbookRunner.restore(tampered, basePorts())).rejects.toMatchObject({
      code: "cellsMismatch",
    });

    const store = createMemoryOutputStore();
    const withStore = new WorkbookRunner({
      cells: battery,
      ports: basePorts({
        commandExecutor: createSimulatedExecutor({
          respond: () => ({ blob: "y".repeat(300_000) }),
        }),
        outputStore: store,
      }),
    });
    withStore.start();
    await waitFor(withStore, (s) => s.tracks.main.cursor.cellId === "m1", "m1");
    const offloaded = await withStore.snapshotOffloaded();
    await expect(WorkbookRunner.restore(offloaded, basePorts())).rejects.toMatchObject({
      code: "missingStore",
    });
  });

  it("a subscriber cancelling synchronously on 'running' still aborts the command", async () => {
    const { manual, runner } = manualRunner();
    runner.subscribe((s) => {
      if (s.status === "running") runner.cancel();
    });
    runner.start();
    const state = await waitFor(runner, (s) => s.cellRuns.c1?.status === "cancelled", "cancelled");
    expect(manual.pending[0]?.signal.aborted).toBe(true);
    expect(state.outputs).toEqual({});
  });

  it("subscribers can unsubscribe and construction validates cell ids", () => {
    expect(
      () =>
        new WorkbookRunner({
          cells: [
            ...battery,
            { id: "c1__dispatch", type: "markdown", isCollapsed: false, content: "" },
          ],
          ports: basePorts(),
        }),
    ).toThrow(/reserved/);
    expect(
      () =>
        new WorkbookRunner({
          cells: [...battery, battery[0]],
          ports: basePorts(),
        }),
    ).toThrow(/Duplicate/);

    const runner = new WorkbookRunner({ cells: battery, ports: basePorts() });
    let calls = 0;
    const unsub = runner.subscribe(() => {
      calls += 1;
    });
    unsub();
    runner.start();
    expect(calls).toBe(0);
  });
});
