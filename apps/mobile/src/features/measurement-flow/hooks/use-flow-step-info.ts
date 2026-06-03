import { isQuestionsOnlyFlow } from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import type {
  FlowNode,
  FlowNodeType,
} from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

export type StepTypeKey =
  | "instruction"
  | "question"
  | "measurement"
  | "analysis"
  | "review"
  | "completed";

export interface FlowStepInfo {
  /** 1-indexed step number to display in the hero. */
  currentStep: number;
  /** Total number of displayable steps (flow nodes + special states). */
  totalSteps: number;
  /** i18n key suffix under `measurementFlow:hero.stepTypeLabel.*`. */
  stepTypeKey: StepTypeKey;
  /** 0..1 progress for the hero bar. */
  progress: number;
}

const TYPE_TO_KEY: Record<FlowNodeType, StepTypeKey> = {
  instruction: "instruction",
  question: "question",
  measurement: "measurement",
  analysis: "analysis",
  branch: "instruction",
};

function deriveStepInfo(
  flowNodes: FlowNode[],
  currentFlowStep: number,
  experimentId: string | undefined,
  isQuestionsSubmitPending: boolean,
  isFlowFinished: boolean,
): FlowStepInfo {
  const questionsOnly = isQuestionsOnlyFlow(flowNodes);
  const totalSteps = Math.max(1, flowNodes.length + (questionsOnly ? 1 : 0));

  // Resolve the rendering state first — order matters here.
  const finishedAfterAllNodes = isFlowFinished && currentFlowStep >= flowNodes.length;

  let currentStep: number;
  let stepTypeKey: StepTypeKey;

  if (!experimentId || flowNodes.length === 0) {
    currentStep = 1;
    stepTypeKey = "instruction";
  } else if (finishedAfterAllNodes) {
    currentStep = totalSteps;
    stepTypeKey = "completed";
  } else if (isQuestionsSubmitPending) {
    currentStep = flowNodes.length + 1;
    stepTypeKey = "review";
  } else {
    currentStep = Math.min(flowNodes.length, currentFlowStep + 1);
    const node = flowNodes[currentFlowStep];
    stepTypeKey = node ? TYPE_TO_KEY[node.type] : "instruction";
  }

  const progress = Math.min(1, Math.max(0, currentStep / totalSteps));
  return { currentStep, totalSteps, stepTypeKey, progress };
}

/** Snapshot variant used by the FlowHero. */
export function useFlowStepInfo(): FlowStepInfo {
  const flowNodes = useMeasurementFlowStore((s) => s.flowNodes);
  const currentFlowStep = useMeasurementFlowStore((s) => s.currentFlowStep);
  const experimentId = useMeasurementFlowStore((s) => s.experimentId);
  const isQuestionsSubmitPending = useMeasurementFlowStore((s) => s.isQuestionsSubmitPending);
  const isFlowFinished = useMeasurementFlowStore((s) => s.isFlowFinished);

  return deriveStepInfo(
    flowNodes,
    currentFlowStep,
    experimentId,
    isQuestionsSubmitPending,
    isFlowFinished,
  );
}

export { deriveStepInfo as __testing_deriveStepInfo };
