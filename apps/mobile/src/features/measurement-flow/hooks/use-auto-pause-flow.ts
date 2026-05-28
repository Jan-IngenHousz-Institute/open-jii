import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";

// Save a snapshot when the flow screen blurs mid-flow. useFocusEffect's
// cleanup IS the blur handler, so no isFocused subscription or guard.
export function useAutoPauseFlow(experimentLabel: string): void {
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        const {
          experimentId,
          protocolId,
          currentFlowStep,
          flowNodes,
          iterationCount,
          isQuestionsSubmitPending,
          isFromOverview,
          isFlowFinished,
          scanResult,
        } = useMeasurementFlowStore.getState();
        if (!experimentId) return;
        if (isFlowFinished) return;
        if (currentFlowStep <= 0 && !isQuestionsSubmitPending) return;

        usePausedFlowStore.getState().pauseFlow({
          experimentId,
          experimentLabel,
          protocolId,
          currentFlowStep,
          totalSteps: flowNodes.length,
          iterationCount,
          isQuestionsSubmitPending,
          isFromOverview,
          flowNodes,
          // Detach from the live store so later answer mutations can't rewrite
          // the paused snapshot.
          answersHistory: structuredClone(useFlowAnswersStore.getState().answersHistory),
          scanResult,
          pausedAt: new Date().toISOString(),
        });
      };
    }, [experimentLabel]),
  );
}
