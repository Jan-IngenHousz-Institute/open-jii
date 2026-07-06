import { describe, expect, it } from "vitest";

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
import type { CellNamespace } from "../namespace/build-cell-namespace";
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
  runner.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
  await waitFor(runner, (s) => s.position.cellId === "md_done", "md_done");
  runner.send({ type: "NEXT" });
  return waitFor(runner, (s) => s.status === "done", "done");
}

describe("WorkbookRunner: spike scenarios", () => {
  it("runs a good reading straight through to done", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    const state = await runSampleToDone(sample);
    expect(state.branchVisits.branch_quality).toBe(1);
    expect(sample.allCalls.filter((c) => c.source.kind === "protocolCell")).toHaveLength(1);
    expect(Object.keys(state.outputs).sort()).toEqual([
      "cmd_battery",
      "macro_construct",
      "macro_construct__dispatch",
      "macro_phi2",
      "proto_psii",
    ]);
  });

  it("macros read the verbatim upstream scan and the ctx namespace", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    await runSampleToDone(sample);
    const input = sample.macroInputs[0];
    expect(input.json).toEqual(scanAttempts[1]);
    expect(input.ctx.ctx.measured_in_sunlight).toEqual({ answer: "yes" });
    const output = sample.runner.getState().outputs.macro_phi2;
    expect(output).toEqual({ v: { Phi2: 0.747, sunlit: true, samples: 3 } });
  });

  it("dispatches the macro-constructed protocol through validation", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    const state = await runSampleToDone(sample);
    const dispatch = sample.allCalls.find((c) => c.source.kind === "artifact");
    if (dispatch?.source.kind !== "artifact") throw new Error("no dispatch call");
    expect(dispatch.source.producedBy).toBe("macro_construct");
    expect(dispatch.family).toBe("multispeq");
    expect(Array.isArray(dispatch.command)).toBe(true);
    expect(state.outputs.macro_construct__dispatch).toEqual({ v: { dispatched: true } });
  });

  it("loops back and remeasures on a noisy first reading", async () => {
    const sample = makeSampleRunner();
    const state = await runSampleToDone(sample);
    expect(state.branchVisits.branch_quality).toBe(2);
    expect(sample.allCalls.filter((c) => c.source.kind === "protocolCell")).toHaveLength(2);
    expect(state.cellRuns.macro_phi2?.executionOrder).toHaveLength(2);
    expect(state.outputs.macro_phi2).toEqual({ v: { Phi2: 0.747, sunlit: true, samples: 3 } });
  });

  it("accumulates answers and outputs in context", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    const state = await runSampleToDone(sample);
    expect(state.answersByCycle[0]).toEqual({ q_sunlight: "yes" });
    expect(state.outputs.cmd_battery).toEqual({ v: "82%" });
  });

  it("ignores ANSWER events that target a different cell", () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    sample.runner.start();
    sample.runner.send({ type: "NEXT" });
    sample.runner.send({ type: "ANSWER", cellId: "md_done", value: "nope" });
    expect(sample.runner.getState().position.cellId).toBe("q_sunlight");
    expect(sample.runner.getState().answersByCycle[0]).toEqual({});
  });

  it("survives a JSON snapshot round-trip mid-flow and resumes to done", async () => {
    const sample = makeSampleRunner([scanAttempts[1]]);
    sample.runner.start();
    sample.runner.send({ type: "NEXT" });
    expect(sample.runner.getState().position.cellId).toBe("q_sunlight");

    const snapshot: unknown = JSON.parse(JSON.stringify(sample.runner.snapshot()));
    const revived = makeSampleRunner([scanAttempts[1]]);
    const restored = await WorkbookRunner.restore(
      snapshot,
      createSamplePorts([scanAttempts[1]], { clock: revived.clock }).ports,
    );
    expect(restored.getState().position.cellId).toBe("q_sunlight");
    restored.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
    await waitFor(restored, (s) => s.position.cellId === "md_done", "md_done");
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

describe("WorkbookRunner: driver behavior", () => {
  it("streams progress into state and clears it on completion", async () => {
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({ commandExecutor: createSimulatedExecutor({ progressTicks: 3 }) }),
    });
    const seen: CommandProgress[] = [];
    runner.subscribe((s) => {
      if (s.progress) seen.push(s.progress);
    });
    runner.start();
    await waitFor(runner, (s) => s.position.cellId === "m1", "m1");
    expect(seen.map((p) => p.phase)).toEqual(["sent", "receiving", "receiving", "receiving"]);
    expect(seen[3].chunks).toBe(3);
    expect(runner.getState().progress).toBeNull();
  });

  it("cancel aborts the signal, discards the late result, and RETRY recovers", async () => {
    const manual = createManualExecutor();
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({ commandExecutor: manual }),
    });
    runner.start();
    await waitFor(runner, (s) => s.status === "running", "running");
    const pending = manual.pending.shift();
    if (!pending) throw new Error("no pending command");
    runner.cancel();
    const cancelled = await waitFor(runner, (s) => s.status === "awaitingInput", "re-armed");
    expect(pending.signal.aborted).toBe(true);
    expect(cancelled.cellRuns.c1?.status).toBe("cancelled");
    // The device answers anyway: nothing may record.
    pending.resolve({ phantom: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(runner.getState().outputs).toEqual({});
    runner.send({ type: "RETRY" });
    await waitFor(runner, (s) => s.status === "running", "running again");
    manual.settle("82%");
    const done = await waitFor(runner, (s) => s.cellRuns.c1?.status === "completed", "completed");
    expect(done.outputs.c1).toEqual({ v: "82%" });
  });

  it("snapshot taken mid-command re-arms the cell as interrupted", async () => {
    const manual = createManualExecutor();
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({ commandExecutor: manual }),
    });
    runner.start();
    await waitFor(runner, (s) => s.status === "running", "running");
    const snapshot = runner.snapshot();
    expect(snapshot.state.status).toBe("awaitingInput");
    expect(snapshot.state.cellRuns.c1?.status).toBe("interrupted");
    expect(snapshot.state.inFlight).toBeNull();

    const restored = await WorkbookRunner.restore(
      JSON.parse(JSON.stringify(snapshot)),
      basePorts(),
    );
    expect(restored.getState().status).toBe("awaitingInput");
    restored.send({ type: "RETRY" });
    const done = await waitFor(restored, (s) => s.cellRuns.c1?.status === "completed", "done");
    expect(done.outputs.c1).toEqual({ v: { echoed: "battery" } });
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
    await waitFor(runner, (s) => s.position.cellId === "m1", "m1");

    const snapshot = await runner.snapshotOffloaded();
    const entry = snapshot.state.outputs.c1;
    if (!("ref" in entry)) throw new Error("expected a ref entry");
    expect(JSON.stringify(snapshot).length).toBeLessThan(20_000);

    const restored = await WorkbookRunner.restore(JSON.parse(JSON.stringify(snapshot)), {
      ...basePorts(),
      outputStore: store,
    });
    expect(restored.getState().outputs.c1).toEqual({ v: big });
  });

  it("restore rejects tampered cells and offloaded snapshots without a store", async () => {
    const runner = new WorkbookRunner({ cells: battery, ports: basePorts() });
    runner.start();
    await waitFor(runner, (s) => s.position.cellId === "m1", "m1");

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
    await waitFor(withStore, (s) => s.position.cellId === "m1", "m1");
    const offloaded = await withStore.snapshotOffloaded();
    await expect(WorkbookRunner.restore(offloaded, basePorts())).rejects.toMatchObject({
      code: "missingStore",
    });
  });

  it("a subscriber cancelling synchronously on 'running' still aborts the command", async () => {
    const manual = createManualExecutor();
    const runner = new WorkbookRunner({
      cells: battery,
      ports: basePorts({ commandExecutor: manual }),
    });
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

  it("SnapshotError surfaces for corrupt and future snapshots", async () => {
    await expect(WorkbookRunner.restore("garbage", basePorts())).rejects.toBeInstanceOf(
      SnapshotError,
    );
    await expect(WorkbookRunner.restore({ schemaVersion: 999 }, basePorts())).rejects.toMatchObject(
      { code: "unsupportedVersion" },
    );
  });
});
