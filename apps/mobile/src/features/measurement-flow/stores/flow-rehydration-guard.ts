import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import {
  consumeRejectedUnsupportedPersistedFlow,
  useMeasurementFlowStore,
} from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { hasUnsupportedMobileWorkbookContent } from "~/features/measurement-flow/utils/workbook-capabilities";

// The two flow stores persist under separate AsyncStorage keys, so a kill
// between their writes can leave orphaned answers with no active flow.
// Unsupported flow content is rejected by the flow store's hydration merge,
// before it can become live. Once BOTH stores hydrate, clear that rejected
// envelope plus its separately persisted answers. Also enforce the ordinary
// invariant that no experimentId means no answer history.
export function installFlowRehydrationGuard(): () => void {
  const check = () => {
    if (
      !useMeasurementFlowStore.persist.hasHydrated() ||
      !useFlowAnswersStore.persist.hasHydrated()
    ) {
      return;
    }
    const flow = useMeasurementFlowStore.getState();
    const answers = useFlowAnswersStore.getState();
    if (consumeRejectedUnsupportedPersistedFlow()) {
      flow.resetFlow();
      answers.clearHistory();
      return;
    }
    if (hasUnsupportedMobileWorkbookContent(flow)) {
      flow.resetFlow();
      answers.clearHistory();
      return;
    }
    if (!flow.experimentId && answers.answersHistory.length > 0) {
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
