// Headless demo: `pnpm --filter @repo/workbook demo`. Four acts against
// injected simulators, proving the runtime is host-agnostic: flow run with a
// loop-back branch and a macro-constructed dispatch, freeze/resume, cancel +
// retry, and notebook re-run with stale marking.
import type { CommandRunInput } from "../ports/command-executor";
import { materializeCells } from "../runner/selectors";
import type { RunnerState } from "../runner/state";
import { WorkbookRunner } from "../runner/workbook-runner";
import type { WorkbookRunnerPorts } from "../runner/workbook-runner";
import {
  sampleMacroRegistry,
  sampleProtocolCode,
  sampleWorkbook,
  scanAttempts,
} from "./sample-workbook";
import {
  createCodeResolver,
  createMacroRunner,
  createSimulatedExecutor,
  sleep,
} from "./simulators";

function makePorts(attempts: Record<string, unknown>[]): WorkbookRunnerPorts {
  let protoCall = 0;
  return {
    macroRunner: createMacroRunner(sampleMacroRegistry),
    commandExecutor: createSimulatedExecutor({
      progressTicks: 4,
      tickMs: 40,
      respond: (input: CommandRunInput) => {
        if (input.source.kind === "protocolCell") {
          const attempt = attempts[Math.min(protoCall, attempts.length - 1)];
          protoCall += 1;
          return attempt;
        }
        if (input.source.kind === "artifact") return { dispatched: true, blocks: 1 };
        return "battery: 82%";
      },
    }),
    protocolCodeResolver: createCodeResolver(sampleProtocolCode),
  };
}

function narrate(runner: WorkbookRunner): () => void {
  let last = "";
  return runner.subscribe((s: Readonly<RunnerState>) => {
    const progress = s.progress ? ` [${s.progress.phase} ${s.progress.chunks} chunks]` : "";
    const line = `  ${s.status.padEnd(14)} @ ${s.position.cellId ?? "-"}${progress}`;
    if (line !== last) console.log(line);
    last = line;
  });
}

function waitFor(
  runner: WorkbookRunner,
  pred: (s: Readonly<RunnerState>) => boolean,
): Promise<Readonly<RunnerState>> {
  return new Promise((resolve) => {
    const unsub = runner.subscribe((s) => {
      if (pred(s)) {
        unsub();
        resolve(s);
      }
    });
    if (pred(runner.getState())) resolve(runner.getState());
  });
}

async function actOneFlowRun(): Promise<unknown> {
  console.log("\n=== Act 1: flow run (noisy scan loops back, artifact dispatches) ===");
  const runner = new WorkbookRunner({ cells: sampleWorkbook, ports: makePorts(scanAttempts) });
  narrate(runner);
  runner.start();
  runner.send({ type: "NEXT" });
  runner.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
  await waitFor(runner, (s) => s.position.cellId === "md_done");
  runner.send({ type: "NEXT" });
  const state = await waitFor(runner, (s) => s.status === "done");
  console.log("  outputs:", JSON.stringify(state.outputs, null, 2).replace(/\n/g, "\n  "));
  console.log("  branch visits:", JSON.stringify(state.branchVisits));
  console.log("  trace tail:", state.trace.slice(-4));
  return undefined;
}

async function actTwoFreezeResume(): Promise<unknown> {
  console.log("\n=== Act 2: freeze at the question, JSON round-trip, resume ===");
  const runner = new WorkbookRunner({
    cells: sampleWorkbook,
    ports: makePorts([scanAttempts[1]]),
  });
  runner.start();
  runner.send({ type: "NEXT" });
  const snapshot = runner.snapshot();
  const wire = JSON.stringify(snapshot);
  console.log(
    `  frozen at ${snapshot.state.position.cellId ?? "-"}; snapshot is ${wire.length} bytes of JSON`,
  );
  runner.dispose();

  const restored = await WorkbookRunner.restore(JSON.parse(wire), makePorts([scanAttempts[1]]));
  narrate(restored);
  console.log("  resumed; answering and finishing offline-style:");
  restored.send({ type: "ANSWER", cellId: "q_sunlight", value: "no" });
  await waitFor(restored, (s) => s.position.cellId === "md_done");
  restored.send({ type: "NEXT" });
  const state = await waitFor(restored, (s) => s.status === "done");
  console.log("  done; answers:", JSON.stringify(state.answersByCycle));
  return undefined;
}

async function actThreeCancelRetry(): Promise<unknown> {
  console.log("\n=== Act 3: cancel a slow scan mid-progress, then retry ===");
  const runner = new WorkbookRunner({
    cells: sampleWorkbook,
    ports: makePorts([scanAttempts[1]]),
  });
  narrate(runner);
  runner.start();
  runner.send({ type: "NEXT" });
  runner.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
  await waitFor(runner, (s) => s.progress !== null);
  await sleep(60);
  console.log("  -> CANCEL");
  runner.cancel();
  const cancelled = await waitFor(runner, (s) => s.cellRuns.proto_psii?.status === "cancelled");
  console.log(
    `  proto_psii is ${cancelled.cellRuns.proto_psii?.status ?? "?"}; no output recorded:`,
    cancelled.outputs.proto_psii === undefined,
  );
  console.log("  -> RETRY");
  runner.send({ type: "RETRY" });
  await waitFor(runner, (s) => s.cellRuns.proto_psii?.status === "completed");
  console.log("  scan completed on retry");
  runner.cancel();
  runner.dispose();
  return undefined;
}

async function actFourNotebook(): Promise<unknown> {
  console.log("\n=== Act 4: notebook mode, run-all then re-run one cell (stale marking) ===");
  const runner = new WorkbookRunner({
    cells: sampleWorkbook,
    ports: makePorts([scanAttempts[1]]),
    mode: "notebook",
  });
  runner.send({ type: "RUN_ALL" });
  let state = await waitFor(
    runner,
    (s) => s.status === "awaitingInput" && s.position.cellId === "q_sunlight",
  );
  runner.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
  state = await waitFor(runner, (s) => s.status === "idle" && !s.runAllActive);

  const orders = (s: Readonly<RunnerState>) =>
    Object.fromEntries(
      Object.entries(s.cellRuns).map(([id, run]) => [
        id,
        `${run?.status ?? "?"} #${(run?.executionOrder ?? []).join(",")}`,
      ]),
    );
  console.log("  after run-all:", orders(state));

  runner.send({ type: "RUN_CELL", cellId: "proto_psii" });
  state = await waitFor(
    runner,
    (s) => s.status === "idle" && s.cellRuns.proto_psii?.status === "completed",
  );
  console.log("  after re-running proto_psii:", orders(state));

  runner.send({ type: "RUN_CELL", cellId: "macro_phi2" });
  state = await waitFor(
    runner,
    (s) => s.status === "idle" && s.cellRuns.macro_phi2?.status === "completed",
  );
  console.log("  after re-running macro_phi2:", orders(state));
  console.log("  materialized cell count (web-style view):", materializeCells(state).length);
  return undefined;
}

async function main(): Promise<void> {
  await actOneFlowRun();
  await actTwoFreezeResume();
  await actThreeCancelRetry();
  await actFourNotebook();
  console.log("\nAll four acts completed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
