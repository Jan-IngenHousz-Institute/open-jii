import { useRouter } from "expo-router";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

/**
 * Finish a flow: tear down all flow state and land on Recent Measurements.
 * `router.replace` drops the pushed flow screen so it can't be swiped back in.
 *
 * Call only AFTER the measurement/questions upload has been awaited —
 * `resetFlow()` clears the `experimentId`/`scanResult` the upload reads.
 */
export function useFinishFlow() {
  const router = useRouter();
  return () => {
    useMeasurementFlowStore.getState().resetFlow();
    useFlowAnswersStore.getState().clearHistory();
    useExperimentSelectionStore.getState().setSelectedExperimentId(undefined);
    router.replace("/(tabs)/recent-measurements");
  };
}
