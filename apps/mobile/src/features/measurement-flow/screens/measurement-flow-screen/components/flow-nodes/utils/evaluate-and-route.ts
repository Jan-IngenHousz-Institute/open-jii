import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import type { BranchCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { evaluateBranch } from "@repo/api/utils/evaluate-branch";

import { FlowNode } from "../../../types";
import { hydrateCells } from "./hydrate-cells";

// Caps branch goto-loops; mirrors web's useWorkbookExecution MAX_VISITS_PER_CELL.
export const MAX_BRANCH_VISITS = 100;

// Advance one step, reusing the store's wrap-around so a branch behaves like
// any other node when it is the last / a mid-flow step. On a mid-flow advance
// it records a Back-return so stepping back unwinds past this auto-advancing
// branch instead of re-triggering its forward evaluation.
function advanceSequential(): void {
  const { currentFlowStep, flowNodes, nextStep, setCurrentFlowStep, recordBranchJump } =
    useMeasurementFlowStore.getState();
  const nextIndex = currentFlowStep + 1;
  if (nextIndex >= flowNodes.length) {
    nextStep();
    return;
  }
  recordBranchJump(nextIndex);
  setCurrentFlowStep(nextIndex);
}

// Evaluates a branch via the reused `evaluateBranch` (first match wins, else
// default) and routes: matched `gotoCellId` jumps to that node's index, else
// falls through. A per-node visit cap stops goto-loops. Pure/offline-safe.
export function evaluateAndRoute(node: FlowNode): void {
  const flow = useMeasurementFlowStore.getState();

  // Guard against stale / double invocation (e.g. dev StrictMode): only the
  // currently-active branch node may route.
  if (flow.flowNodes[flow.currentFlowStep]?.id !== node.id) return;

  // Depth guard: once this branch has fired too many times, stop looping.
  if ((flow.branchVisitCounts[node.id] ?? 0) >= MAX_BRANCH_VISITS) {
    flow.setLastMatchedPath(undefined);
    advanceSequential();
    return;
  }
  flow.incrementBranchVisit(node.id);

  const { getAnswer } = useFlowAnswersStore.getState();
  const hydrated: WorkbookCell[] = hydrateCells(flow.cells, {
    iterationCount: flow.iterationCount,
    getAnswer,
    scanResult: flow.scanResult,
    protocolId: flow.protocolId,
  });

  const branchCell = hydrated.find((c): c is BranchCell => c.id === node.id && c.type === "branch");
  if (!branchCell) {
    // No workbook cell backs this node (legacy flow / missing data): clear any
    // stale chip and fall through.
    flow.setLastMatchedPath(undefined);
    advanceSequential();
    return;
  }

  const matched = evaluateBranch(branchCell, hydrated);
  flow.setLastMatchedPath(matched ? { label: matched.label, color: matched.color } : undefined);

  if (matched?.gotoCellId) {
    const idx = flow.flowNodes.findIndex((n) => n.id === matched.gotoCellId);
    // Ignore a no-op self-jump (would stall on the branch); fall through instead.
    if (idx >= 0 && idx !== flow.currentFlowStep) {
      // Record the jump first so Back unwinds it instead of stepping into a
      // node this matched path skipped over.
      flow.recordBranchJump(idx);
      flow.setCurrentFlowStep(idx);
      return;
    }
  }

  advanceSequential();
}
