import { createActor } from "xstate";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { sampleMacroRegistry, sampleWorkbook } from "./sample-workbook";
import { createRuntime } from "./runtime";
import { buildWorkbookMachine, createWorkbookActor } from "./workbook-machine";

const tick = () => new Promise((r) => setTimeout(r, 0));

function answerFor(cell: Extract<WorkbookCell, { type: "question" }>): string {
  switch (cell.question.kind) {
    case "yes_no":
      return "yes";
    case "number":
      return "42";
    case "multi_choice":
      return cell.question.options[0];
    default:
      return "demo answer";
  }
}

// Pump the actor to completion: answer questions, advance instructions, and let
// invoked steps (measurement/macro) and branches auto-advance.
async function pump(actor: ReturnType<typeof createWorkbookActor>, cells: WorkbookCell[]) {
  let guard = 0;
  while (actor.getSnapshot().status === "active" && guard++ < 1000) {
    const value = String(actor.getSnapshot().value);
    const cell = cells.find((c) => c.id === value);
    if (cell?.type === "markdown") {
      actor.send({ type: "NEXT" });
    } else if (cell?.type === "question") {
      actor.send({ type: "ANSWER", cellId: cell.id, value: answerFor(cell) });
    } else {
      await tick(); // measurement / macro / branch settle on their own
    }
  }
}

async function main() {
  const cells = sampleWorkbook;

  console.log("\n=== 1. Run the workbook as a dynamic XState machine ===\n");
  const runtime = createRuntime(sampleMacroRegistry);
  const actor = createWorkbookActor(cells, runtime);
  actor.subscribe((s: { value: unknown }) => console.log(`  state -> ${String(s.value)}`));
  actor.start();
  await pump(actor, cells);

  const final = actor.getSnapshot();
  console.log("\n  status:", final.status);
  console.log("  outputs:", JSON.stringify(final.context.outputs));
  console.log("  branch visits:", JSON.stringify(final.context.visits));
  console.log("\n  trace:");
  for (const line of final.context.trace) console.log("   -", line);

  console.log("\n=== 2. Persist mid-flow, restore, and continue ===\n");
  const machine = buildWorkbookMachine(cells, createRuntime(sampleMacroRegistry));
  const a1 = createActor(machine, { input: { cells } });
  a1.start();
  // advance only the first instruction, then freeze
  a1.send({ type: "NEXT" });
  const frozen = a1.getPersistedSnapshot();
  console.log("  frozen at:", JSON.stringify((frozen as unknown as { value: unknown }).value));
  a1.stop();

  const serialized = JSON.stringify(frozen); // proves the snapshot is JSON
  const a2 = createActor(machine, { snapshot: JSON.parse(serialized), input: { cells } });
  a2.subscribe((s: { value: unknown }) => console.log(`  resumed -> ${String(s.value)}`));
  a2.start();
  await pump(a2, cells);
  console.log("\n  resumed status:", a2.getSnapshot().status);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
