import { useEffect } from "react";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import type { FlowNode, QuestionContent } from "../screens/measurement-flow-screen/types";
import { findNextMandatoryStep } from "../screens/measurement-flow-screen/components/flow-nodes/utils/advance-with-answer";

/**
 * On every new iteration of the measurement flow, carry forward
 * remembered / auto-incremented answers from the previous iteration and
 * jump the user to the first step that still needs manual input.
 *
 * Previously lived as a 30-line useEffect inline in
 * measurement-flow-container.tsx; extracted so the container stays
 * presentation-only.
 */
export function useIterationStateSync(flowNodes: FlowNode[]): void {
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const setCurrentFlowStep = useMeasurementFlowStore((s) => s.setCurrentFlowStep);

  useEffect(() => {
    if (iterationCount === 0 || flowNodes.length === 0) return;

    const { getAnswer, setAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } =
      useFlowAnswersStore.getState();

    for (const node of flowNodes) {
      if (node.type !== "question") continue;
      const content = node.content as QuestionContent | undefined;
      if (!content) continue;
      if (getAnswer(iterationCount, node.id)?.trim()) continue;

      const previous = getAnswer(iterationCount - 1, node.id)?.trim();
      if (!previous) continue;

      if (content.kind === "multi_choice" && isAutoincrementEnabled(node.id)) {
        const options = content.options ?? [];
        if (!options.length) continue;
        const idx = options.indexOf(previous);
        if (idx < 0) continue;
        setAnswer(iterationCount, node.id, options[(idx + 1) % options.length]);
        continue;
      }

      if (isRememberAnswerEnabled(node.id)) {
        setAnswer(iterationCount, node.id, previous);
      }
    }

    const first = findNextMandatoryStep(-1, flowNodes, iterationCount);
    setCurrentFlowStep(first < flowNodes.length ? first : 0);
  }, [iterationCount, flowNodes, setCurrentFlowStep]);
}
