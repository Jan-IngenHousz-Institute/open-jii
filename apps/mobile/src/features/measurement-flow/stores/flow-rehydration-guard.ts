import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

// The two flow stores persist under separate AsyncStorage keys, so a kill
// between their writes can leave orphaned answers with no active flow.
// Once BOTH have hydrated, enforce the invariant: no experimentId means no
// answer history. Mounted once at app boot; returns an unsubscribe fn.
export function installFlowRehydrationGuard(): () => void {
  const check = () => {
    if (
      !useMeasurementFlowStore.persist.hasHydrated() ||
      !useFlowAnswersStore.persist.hasHydrated()
    ) {
      return;
    }
    const { experimentId } = useMeasurementFlowStore.getState();
    const answers = useFlowAnswersStore.getState();
    if (!experimentId && answers.answersHistory.length > 0) {
      answers.clearHistory();
    }
  };

  const unsubFlow = useMeasurementFlowStore.persist.onFinishHydration(check);
  const unsubAnswers = useFlowAnswersStore.persist.onFinishHydration(check);
  check();
  return () => {
    unsubFlow();
    unsubAnswers();
  };
}
