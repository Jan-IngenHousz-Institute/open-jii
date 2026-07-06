import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";

/**
 * Tear down the whole flow session: the runner-backed flow, answer history,
 * and the experiment selection. The single home for the reset pairing shared
 * by exit-flow-sheet and use-finish-flow.
 */
export function teardownFlow(): void {
  useWorkbookFlowStore.getState().abandonFlow();
  useFlowAnswersStore.getState().clearHistory();
  useExperimentSelectionStore.getState().setSelectedExperimentId(undefined);
}
