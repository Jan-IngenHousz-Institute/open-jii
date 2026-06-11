import type { FlowNode } from "~/shared/measurements/flow-node";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";

// Raw MultispeQ output: device-defined JSON the flow stores verbatim and
// hands to macro evaluation / upload. Persisted, so keep it structural.
export type ScanResult = Record<string, unknown>;

// The persisted flow-session state. Field names ARE the AsyncStorage wire
// format (see flow-store-persistence.test.ts) — renaming or removing one
// requires a persist version bump + migrate, or paused field flows are lost.
export interface FlowState {
  experimentId?: string;
  experimentLabel?: string;
  protocolId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  isFlowFinished: boolean;
  isQuestionsSubmitPending: boolean;
  scanResult?: ScanResult;
  isFromOverview: boolean;
}

export const initialFlowState: FlowState = {
  experimentId: undefined,
  experimentLabel: undefined,
  protocolId: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,
  isQuestionsSubmitPending: false,
  scanResult: undefined,
  isFromOverview: false,
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
      return { currentFlowStep: 0, iterationCount: state.iterationCount + 1 };
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
    if (state.currentFlowStep > 0) {
      return { currentFlowStep: state.currentFlowStep - 1 };
    }
    // Backing out of step 0 abandons the active flow entirely.
    // NB: deliberately leaves isFromOverview untouched (it is false here).
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
      protocolId: undefined,
    };
  }
  return { currentStep: Math.max(0, state.currentStep - 1) };
}

export function resetFlowState(): Partial<FlowState> {
  return { ...initialFlowState };
}

export function retryIterationState(): Partial<FlowState> {
  return {
    currentFlowStep: 0,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    isFromOverview: false,
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
  };
}

export function navigateToQuestionFromOverviewState(questionIndex: number): Partial<FlowState> {
  return {
    currentFlowStep: questionIndex,
    isFromOverview: true,
    isQuestionsSubmitPending: false,
  };
}

export function returnToOverviewState(state: FlowState): Partial<FlowState> {
  if (isQuestionsOnlyFlow(state.flowNodes)) {
    return { isQuestionsSubmitPending: true, isFromOverview: false };
  }
  return { currentFlowStep: firstMeasurementStep(state.flowNodes), isFromOverview: false };
}
