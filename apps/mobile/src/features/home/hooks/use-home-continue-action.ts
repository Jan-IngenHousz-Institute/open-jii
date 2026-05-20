import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";

/**
 * Resume a paused flow: atomically read + clear the snapshot, rehydrate the
 * measurement-flow runner, then navigate to the Measure tab.
 */
export function useHomeContinueAction() {
  const router = useRouter();

  return useCallback(() => {
    const snap = usePausedFlowStore.getState().resumePausedFlow();
    if (!snap) return;

    useExperimentSelectionStore.getState().setSelectedExperimentId(snap.experimentId);

    // setFlowNodes resets currentFlowStep to 0; set it again afterwards.
    const flowStore = useMeasurementFlowStore.getState();
    flowStore.setExperimentId(snap.experimentId);
    if (snap.protocolId) flowStore.setProtocolId(snap.protocolId);
    flowStore.setFlowNodes(snap.flowNodes);
    flowStore.setCurrentFlowStep(snap.currentFlowStep);

    useMeasurementFlowStore.setState({
      iterationCount: snap.iterationCount,
      isQuestionsSubmitPending: snap.isQuestionsSubmitPending,
      isFromOverview: snap.isFromOverview,
    });

    useFlowAnswersStore.setState({ answersHistory: snap.answersHistory });

    router.push("/(tabs)/measurement-flow");
  }, [router]);
}
