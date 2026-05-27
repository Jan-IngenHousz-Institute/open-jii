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

    // If the snapshot landed on the analysis node but the scan result is
    // missing (legacy snapshot from before scanResult was persisted), snap
    // back to the measurement node so the user can re-scan instead of being
    // stuck on an inert "Accept data" button.
    const targetNode = snap.flowNodes[snap.currentFlowStep];
    const needsRescan = targetNode?.type === "analysis" && snap.scanResult === undefined;
    const measurementStep = snap.flowNodes.findIndex((n) => n.type === "measurement");
    const resumeStep = needsRescan && measurementStep >= 0 ? measurementStep : snap.currentFlowStep;
    flowStore.setCurrentFlowStep(resumeStep);

    useMeasurementFlowStore.setState({
      iterationCount: snap.iterationCount,
      isQuestionsSubmitPending: snap.isQuestionsSubmitPending,
      isFromOverview: snap.isFromOverview,
      scanResult: snap.scanResult,
    });

    useFlowAnswersStore.setState({ answersHistory: snap.answersHistory });

    router.push("/(tabs)/measurement-flow");
  }, [router]);
}
