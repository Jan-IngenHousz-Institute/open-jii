import { useEffect } from "react";
import {
  carryForwardAnswers,
  findNextMandatoryStep,
  firstManualQuestionNodeId,
} from "~/features/measurement-flow/domain/iteration";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

/**
 * On every new iteration of the measurement flow, carry forward
 * remembered / auto-incremented answers from the previous iteration and
 * jump the user to the first step that still needs manual input.
 *
 * The rules are pure functions in ../domain/iteration.ts; this hook only
 * reads the stores, applies the returned seeds, and anchors the
 * AutoProceededSummary banner for the new iteration.
 */
export function useIterationStateSync(flowNodes: FlowNode[]): void {
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const setCurrentFlowStep = useMeasurementFlowStore((s) => s.setCurrentFlowStep);
  const setIterationAnchor = useMeasurementFlowStore((s) => s.setIterationAnchor);

  useEffect(() => {
    if (iterationCount === 0 || flowNodes.length === 0) return;

    const answersStore = useFlowAnswersStore.getState();
    const seeds = carryForwardAnswers({ flowNodes, iterationCount, answers: answersStore });
    for (const seed of seeds) {
      answersStore.setAnswer(seed.cycle, seed.name, seed.value);
    }

    const answers = useFlowAnswersStore.getState();
    setIterationAnchor({
      iteration: iterationCount,
      nodeId: firstManualQuestionNodeId(flowNodes, answers),
    });

    const first = findNextMandatoryStep({ fromIndex: -1, flowNodes, iterationCount, answers });
    setCurrentFlowStep(first < flowNodes.length ? first : 0);
  }, [iterationCount, flowNodes, setCurrentFlowStep, setIterationAnchor]);
}
