import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import type { FlowNode, FlowNodeType } from "~/shared/measurements/flow-node";

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
): FlowStepInfo {
  const questionsOnly = isQuestionsOnlyFlow(flowNodes);
  // Branch nodes route invisibly inside the runner, so they're excluded from
  // the count; "Step X of Y" would otherwise skip a number over them.
  const visibleCount = flowNodes.reduce((n, node) => n + (node.type === "branch" ? 0 : 1), 0);
  const totalSteps = Math.max(1, visibleCount + (questionsOnly ? 1 : 0));

  let currentStep: number;
  let stepTypeKey: StepTypeKey;

  if (!experimentId || flowNodes.length === 0) {
    currentStep = 1;
    stepTypeKey = "instruction";
  } else if (isQuestionsSubmitPending) {
    currentStep = totalSteps;
    stepTypeKey = "review";
  } else {
    const node = flowNodes[currentFlowStep];
    // Count visible nodes up to the current position; while sitting on a
    // branch's spinner, hold at the prior step rather than counting the branch.
    const visibleBefore = flowNodes
      .slice(0, currentFlowStep)
      .reduce((n, prev) => n + (prev.type === "branch" ? 0 : 1), 0);
    const isBranch = node?.type === "branch";
    currentStep = Math.min(visibleCount, Math.max(1, isBranch ? visibleBefore : visibleBefore + 1));
    stepTypeKey = node ? TYPE_TO_KEY[node.type] : "instruction";
  }

  const progress = Math.min(1, Math.max(0, currentStep / totalSteps));
  return { currentStep, totalSteps, stepTypeKey, progress };
}

/** Snapshot variant used by the FlowHero. */
export function useFlowStepInfo(): FlowStepInfo {
  const flowNodes = useWorkbookFlowStore((s) => s.flowNodes);
  const currentFlowStep = useWorkbookFlowStore((s) => s.currentNodeIndex);
  const experimentId = useWorkbookFlowStore((s) => s.experimentId);
  const isQuestionsSubmitPending = useWorkbookFlowStore((s) => s.isQuestionsSubmitPending);

  return deriveStepInfo(flowNodes, currentFlowStep, experimentId, isQuestionsSubmitPending);
}

export { deriveStepInfo as __testing_deriveStepInfo };
