import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import {
  findNextMandatoryStep,
  seedNextIterationAnswer,
} from "~/features/measurement-flow/domain/iteration";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

// The sanctioned imperative entry points over the flow stores. Components
// and hooks call these; the rules themselves live in ../domain.

/**
 * Seeds the answer for the next iteration, then jumps directly to the first
 * step that still needs manual input (skipping over questions that already
 * have a seeded answer for the current iteration).
 */
export function advanceWithAnswer(node: FlowNode, answerValue: string): void {
  const flow = useMeasurementFlowStore.getState();

  const seed = seedNextIterationAnswer({
    node,
    answerValue,
    iterationCount: flow.iterationCount,
    answers: useFlowAnswersStore.getState(),
  });
  if (seed) useFlowAnswersStore.getState().setAnswer(seed.cycle, seed.name, seed.value);

  const nextMandatory = findNextMandatoryStep({
    fromIndex: flow.currentFlowStep,
    flowNodes: flow.flowNodes,
    iterationCount: flow.iterationCount,
    answers: useFlowAnswersStore.getState(),
  });
  if (flow.isFromOverview) {
    flow.returnToOverview();
  } else if (nextMandatory >= flow.flowNodes.length) {
    // Every remaining step is done – trigger iteration completion / wrap-around
    flow.nextStep();
  } else {
    flow.setCurrentFlowStep(nextMandatory);
  }
}

/**
 * Tear down the whole flow session: active flow, answer history, and the
 * experiment selection. The single home for the reset pairing previously
 * duplicated across exit-flow-sheet and use-finish-flow.
 */
export function teardownFlow(): void {
  useMeasurementFlowStore.getState().resetFlow();
  useFlowAnswersStore.getState().clearHistory();
  useExperimentSelectionStore.getState().setSelectedExperimentId(undefined);
}
