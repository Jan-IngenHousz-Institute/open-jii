import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FlowNode } from "../../../types";

/**
 * Returns the index of the first flow step after `fromIndex` that requires
 * manual user interaction (i.e. must not be auto-skipped).
 *
 * Skip rules:
 *  - `instruction` nodes are skipped on iterations > 0
 *  - `question` nodes that have "remember answer" or "auto-increment" enabled are always
 *    skipped, regardless of iteration or current value
 *  - every other node type (measurement, analysis, …) stops the search
 *
 * Returns `flowNodes.length` if every remaining step is skippable (edge case).
 */
export function findNextMandatoryStep(
  fromIndex: number,
  flowNodes: FlowNode[],
  iterationCount: number,
): number {
  const { isAutoincrementEnabled, isRememberAnswerEnabled } = useFlowAnswersStore.getState();
  for (let i = fromIndex + 1; i < flowNodes.length; i++) {
    const node = flowNodes[i];
    if (node.type === "instruction" && iterationCount > 0) continue;
    if (node.type === "question") {
      if (isAutoincrementEnabled(node.id) || isRememberAnswerEnabled(node.id)) continue;
    }
    return i;
  }
  return flowNodes.length;
}

/**
 * Seeds the answer for the NEXT iteration, then jumps directly to the first
 * step that still needs manual input (skipping over questions that already
 * have a seeded answer for the current iteration).
 */
export function advanceWithAnswer(node: FlowNode, answerValue: string) {
  const { setAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } =
    useFlowAnswersStore.getState();
  const {
    iterationCount,
    currentFlowStep,
    nextStep,
    returnToOverviewAfterEdit,
    setReturnToOverviewAfterEdit,
    flowNodes,
    setCurrentFlowStep,
  } = useMeasurementFlowStore.getState();
  const content = node.content;

  // Always clear the flag — whether we came from overview or normal flow,
  // the navigation logic below is identical.
  if (returnToOverviewAfterEdit) {
    setReturnToOverviewAfterEdit(false);
  }

  // Seed this answer into the NEXT iteration
  if (content.kind === "multi_choice") {
    if (isAutoincrementEnabled(node.id) && answerValue) {
      const options = content.options ?? [];
      const currentIndex = options.indexOf(answerValue);
      const nextIndex = (currentIndex + 1) % options.length;
      setAnswer(iterationCount + 1, node.id, options[nextIndex]);
    }
  } else if (isRememberAnswerEnabled(node.id) && answerValue) {
    setAnswer(iterationCount + 1, node.id, answerValue);
  }

  // Jump to the next step that actually needs input, skipping any question
  // whose answer is already seeded for this iteration.
  const nextMandatory = findNextMandatoryStep(currentFlowStep, flowNodes, iterationCount);
  if (nextMandatory >= flowNodes.length) {
    // Every remaining step is done – trigger iteration completion / wrap-around
    nextStep();
  } else {
    setCurrentFlowStep(nextMandatory);
  }
}
