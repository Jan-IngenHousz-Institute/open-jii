import { MOBILE_PRE_IDENTITY_FAMILY } from "~/features/connection/services/mobile-runtime-support";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { DeviceExecutorEntry } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { DevicePlanEntry } from "~/features/measurement-flow/domain/flow-transitions";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { FlowNode } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";

import type { BranchCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { toDeviceContext } from "@repo/api/transforms/device-context";
import type { BranchRuntimeContext } from "@repo/api/transforms/evaluate-branch";
import { evaluateBranch, isDeviceScopedBranch } from "@repo/api/transforms/evaluate-branch";

import { hydrateCells } from "./hydrate-cells";

const log = createLogger("evaluate-and-route");

// Identity is best-effort; while the handshake is pending (or failed) the
// family falls back to multispeq, the only family mobile connects today.
function entryIdentity(entry: DeviceExecutorEntry) {
  return (
    entry.identity ?? {
      family: MOBILE_PRE_IDENTITY_FAMILY,
      name: entry.device.name,
      deviceId: entry.device.id,
    }
  );
}

/** `$device` conditions of a non-dispatch branch read the primary device. */
function primaryDeviceRuntime(): BranchRuntimeContext | undefined {
  const primary: DeviceExecutorEntry | undefined = useScannerCommandExecutorStore
    .getState()
    .executors.values()
    .next().value;
  if (!primary) return undefined;
  return { device: toDeviceContext(entryIdentity(primary), 0), deviceId: primary.device.id };
}

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

type FlowStore = ReturnType<typeof useMeasurementFlowStore.getState>;

/**
 * Device-scoped branch = dispatcher (mirrors web's runDeviceDispatchBranch):
 * every connected device evaluates the branch with ITS identity and the plan
 * maps each device to its matched protocol/command cell. The flow routes to
 * the EARLIEST target in flow order; the measurement round there executes
 * every device's own payload, so the other targets are consumed (skipped
 * once). Devices matching no measurement are skipped, never an error.
 */
function dispatchDeviceBranch(
  flow: FlowStore,
  branchCell: BranchCell,
  hydrated: WorkbookCell[],
): void {
  const entries = Array.from(useScannerCommandExecutorStore.getState().executors.values());

  const plan: DevicePlanEntry[] = [];
  const skipped: string[] = [];
  entries.forEach((entry, index) => {
    const matched = evaluateBranch(branchCell, hydrated, {
      device: toDeviceContext(entryIdentity(entry), index),
      deviceId: entry.device.id,
    });
    const target = matched?.gotoCellId
      ? hydrated.find((c) => c.id === matched.gotoCellId)
      : undefined;
    const isMeasurementTarget =
      !!target && (target.type === "protocol" || target.type === "command");
    if (isMeasurementTarget && flow.flowNodes.some((n) => n.id === target.id)) {
      plan.push({ deviceId: entry.device.id, targetCellId: target.id });
    } else {
      skipped.push(entry.device.name);
    }
  });

  // A dispatcher matches several paths at once: no single ACTIVE path chip.
  flow.setLastMatchedPath(undefined);

  if (skipped.length > 0) {
    log.info("dispatch: devices without a matched measurement sit out this round", {
      devices: skipped.join(", "),
    });
  }

  if (plan.length === 0) {
    flow.setDevicePlan(undefined, []);
    advanceSequential();
    return;
  }

  const targetIds = new Set(plan.map((p) => p.targetCellId));
  const firstIdx = flow.flowNodes.findIndex((n) => targetIds.has(n.id));
  const consumed = flow.flowNodes
    .filter((n, i) => targetIds.has(n.id) && i !== firstIdx)
    .map((n) => n.id);
  flow.setDevicePlan(plan, consumed);
  // Same Back semantics as a plain matched jump: only forward records a return.
  if (firstIdx > flow.currentFlowStep) flow.recordBranchJump(firstIdx);
  flow.setCurrentFlowStep(firstIdx);
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
    outputsByCellId: flow.outputsByCellId,
  });

  const branchCell = hydrated.find((c): c is BranchCell => c.id === node.id && c.type === "branch");
  if (!branchCell) {
    // No workbook cell backs this node (legacy flow / missing data): clear any
    // stale chip and fall through.
    flow.setLastMatchedPath(undefined);
    advanceSequential();
    return;
  }

  if (isDeviceScopedBranch(branchCell)) {
    dispatchDeviceBranch(flow, branchCell, hydrated);
    return;
  }

  const matched = evaluateBranch(branchCell, hydrated, primaryDeviceRuntime());
  flow.setLastMatchedPath(matched ? { label: matched.label, color: matched.color } : undefined);

  if (matched?.gotoCellId) {
    const idx = flow.flowNodes.findIndex((n) => n.id === matched.gotoCellId);
    // Ignore a no-op self-jump (would stall on the branch); fall through instead.
    if (idx >= 0 && idx !== flow.currentFlowStep) {
      // Only a forward jump skips over un-visited nodes that Back must unwind
      // past. A backward (loop-back) jump skips nothing, so Back steps linearly
      // from the target; recording a return there would push Back forward.
      if (idx > flow.currentFlowStep) flow.recordBranchJump(idx);
      flow.setCurrentFlowStep(idx);
      return;
    }
  }

  advanceSequential();
}
