import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

// Raw MultispeQ output: device-defined JSON the flow stores verbatim and
// hands to macro evaluation / upload. Persisted, so keep it structural.
export type ScanResult = Record<string, unknown>;

/** The branch path the flow last routed through, surfaced inline in the hero. */
export interface MatchedPath {
  label: string;
  color: string;
}

/** A branch jump: its landing node index and the step Back should return to. */
export interface BranchReturn {
  landing: number;
  step: number;
}

// The persisted flow-session state. Field names ARE the AsyncStorage wire
// format (see flow-store-persistence.test.ts); renaming or removing one
// requires a persist version bump + migrate, or paused field flows are lost.
export interface FlowState {
  experimentId?: string;
  experimentLabel?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  isFlowFinished: boolean;
  isQuestionsSubmitPending: boolean;
  scanResult?: ScanResult;
  // Cell id of the producer (protocol or command) that yielded scanResult;
  // keys the synthetic output cell in hydrateCells for branch evaluation.
  producerCellId?: string;
  isFromOverview: boolean;
  // Workbook-derived data for on-device branch evaluation; empty for legacy
  // flow-only experiments. Persisted so a resumed branching flow keeps routing.
  cells: WorkbookCell[];
  edges: FlowEdge[];
  lastMatchedPath?: MatchedPath;
  branchVisitCounts: Record<string, number>;
  branchReturnStack: BranchReturn[];
}

export const initialFlowState: FlowState = {
  experimentId: undefined,
  experimentLabel: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,
  isQuestionsSubmitPending: false,
  scanResult: undefined,
  producerCellId: undefined,
  isFromOverview: false,
  cells: [],
  edges: [],
  lastMatchedPath: undefined,
  branchVisitCounts: {},
  branchReturnStack: [],
};

// Iteration-scoped branch routing, cleared on every new iteration, retry,
// dismiss or reset so a fresh pass re-evaluates branches from scratch.
const clearedBranchIteration: Partial<FlowState> = {
  branchVisitCounts: {},
  lastMatchedPath: undefined,
  branchReturnStack: [],
};

// One readable interpretation of the mode flags. Precedence mirrors the
// branch order of the transitions below.
export type FlowMode = "preFlow" | "overviewDetour" | "finished" | "reviewPending" | "inFlow";

export function flowMode(state: FlowState): FlowMode {
  if (state.isFromOverview) return "overviewDetour";
  if (state.isFlowFinished) return "finished";
  if (state.isQuestionsSubmitPending) return "reviewPending";
  if (state.experimentId && state.flowNodes.length > 0) return "inFlow";
  return "preFlow";
}

function firstMeasurementStep(flowNodes: FlowNode[]): number {
  return flowNodes.findIndex((n) => n.type === "measurement");
}

// The flow's protocol comes from its measurement node (the flow model
// assumes at most one). Derived from the persisted flowNodes, so it
// survives pause/resume and can never go stale across flows.
export function flowProtocolId(flowNodes: FlowNode[]): string | undefined {
  // A command cell also rides a "measurement" node but carries no protocolId, so
  // match the first node that actually has one; otherwise a leading command node
  // would shadow the real protocol and the upload would fail with "Missing protocol id".
  const node = flowNodes.find(
    (n) =>
      n.type === "measurement" && (n.content as { protocolId?: string } | undefined)?.protocolId,
  );
  return (node?.content as { protocolId?: string } | undefined)?.protocolId;
}

export function nextStepState(state: FlowState): Partial<FlowState> {
  if (state.isFromOverview) {
    return { currentFlowStep: firstMeasurementStep(state.flowNodes), isFromOverview: false };
  }
  if (state.experimentId && state.flowNodes.length > 0) {
    const nextFlowStep = state.currentFlowStep + 1;
    if (nextFlowStep >= state.flowNodes.length) {
      if (isQuestionsOnlyFlow(state.flowNodes)) {
        return { isQuestionsSubmitPending: true, currentFlowStep: state.flowNodes.length };
      }
      // Iteration wraps: start the next pass and clear its branch routing.
      return {
        currentFlowStep: 0,
        iterationCount: state.iterationCount + 1,
        ...clearedBranchIteration,
      };
    }
    return { currentFlowStep: nextFlowStep };
  }
  return { currentStep: state.currentStep + 1 };
}

export function previousStepState(state: FlowState): Partial<FlowState> {
  if (state.isFromOverview) {
    return { currentFlowStep: firstMeasurementStep(state.flowNodes), isFromOverview: false };
  }
  if (state.experimentId && state.flowNodes.length > 0) {
    if (state.isQuestionsSubmitPending) {
      return { isQuestionsSubmitPending: false, currentFlowStep: state.flowNodes.length - 1 };
    }
    // If we arrived here via a branch jump, unwind the jump (return to the step
    // before the branch) rather than stepping into a node the path skipped.
    const branchReturn = state.branchReturnStack[state.branchReturnStack.length - 1];
    const isBranchReturn = !!branchReturn && branchReturn.landing === state.currentFlowStep;
    if (isBranchReturn && branchReturn.step >= 0) {
      return {
        currentFlowStep: branchReturn.step,
        branchReturnStack: state.branchReturnStack.slice(0, -1),
      };
    }
    if (state.currentFlowStep > 0 && !isBranchReturn) {
      return { currentFlowStep: state.currentFlowStep - 1 };
    }
    // Backing out of step 0 (or a branch that jumped from before the flow)
    // abandons the active flow entirely. Leaves isFromOverview untouched.
    return {
      experimentId: undefined,
      experimentLabel: undefined,
      currentStep: 0,
      flowNodes: [],
      currentFlowStep: 0,
      iterationCount: 0,
      isFlowFinished: false,
      isQuestionsSubmitPending: false,
      scanResult: undefined,
      producerCellId: undefined,
      cells: [],
      edges: [],
      ...clearedBranchIteration,
    };
  }
  return { currentStep: Math.max(0, state.currentStep - 1) };
}

export function resetFlowState(): Partial<FlowState> {
  return { ...initialFlowState };
}

export function startNewIterationState(state: FlowState): Partial<FlowState> {
  return {
    currentFlowStep: 0,
    iterationCount: state.iterationCount + 1,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    producerCellId: undefined,
    isFromOverview: false,
    ...clearedBranchIteration,
  };
}

export function retryIterationState(): Partial<FlowState> {
  return {
    currentFlowStep: 0,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    producerCellId: undefined,
    isFromOverview: false,
    ...clearedBranchIteration,
  };
}

export function finishFlowState(state: FlowState): Partial<FlowState> {
  return {
    currentFlowStep: state.flowNodes.length,
    isFlowFinished: true,
    isQuestionsSubmitPending: false,
    isFromOverview: false,
  };
}

export function dismissQuestionsSubmitState(state: FlowState): Partial<FlowState> {
  return {
    isQuestionsSubmitPending: false,
    currentFlowStep: 0,
    iterationCount: state.iterationCount + 1,
    scanResult: undefined,
    producerCellId: undefined,
    ...clearedBranchIteration,
  };
}

export function navigateToQuestionFromOverviewState(questionIndex: number): Partial<FlowState> {
  return {
    currentFlowStep: questionIndex,
    isFromOverview: true,
    isQuestionsSubmitPending: false,
    branchReturnStack: [],
  };
}

export function returnToOverviewState(state: FlowState): Partial<FlowState> {
  if (isQuestionsOnlyFlow(state.flowNodes)) {
    return { isQuestionsSubmitPending: true, isFromOverview: false, branchReturnStack: [] };
  }
  return {
    currentFlowStep: firstMeasurementStep(state.flowNodes),
    isFromOverview: false,
    branchReturnStack: [],
  };
}

// Records where Back should land after a branch jumps to `landing`. Called with
// currentFlowStep still on the branch node. A branch reached via a prior jump
// (a transparent chained branch) inherits that jump's return and replaces it;
// otherwise Back returns to the step before this branch.
export function recordBranchJumpState(state: FlowState, landing: number): Partial<FlowState> {
  const stack = state.branchReturnStack;
  const top = stack[stack.length - 1];
  if (top?.landing === state.currentFlowStep) {
    return { branchReturnStack: [...stack.slice(0, -1), { landing, step: top.step }] };
  }
  return { branchReturnStack: [...stack, { landing, step: state.currentFlowStep - 1 }] };
}
