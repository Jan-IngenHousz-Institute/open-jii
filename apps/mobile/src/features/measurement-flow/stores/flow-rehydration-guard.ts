import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";

// Storage keys of the pre-runner flow stores (v0 wire format). In-progress
// flows are transient; on upgrade the paused v0 flow is dropped rather than
// migrated into the runner snapshot format.
const LEGACY_FLOW_KEY = "measurement-flow-storage";

// The flow and answers stores persist under separate AsyncStorage keys, so a
// kill between their writes can leave orphaned answers with no active flow.
// Once BOTH have hydrated, enforce the invariant: no experimentId means no
// answer history. Mounted once at app boot; returns an unsubscribe fn.
export function installFlowRehydrationGuard(): () => void {
  void AsyncStorage.removeItem(LEGACY_FLOW_KEY).catch(() => undefined);

  const check = () => {
    if (!useWorkbookFlowStore.persist.hasHydrated() || !useFlowAnswersStore.persist.hasHydrated()) {
      return;
    }
    const { experimentId } = useWorkbookFlowStore.getState();
    const answers = useFlowAnswersStore.getState();
    if (!experimentId && answers.answersHistory.length > 0) {
      answers.clearHistory();
    }
  };

  const unsubFlow = useWorkbookFlowStore.persist.onFinishHydration(check);
  const unsubAnswers = useFlowAnswersStore.persist.onFinishHydration(check);
  check();
  return () => {
    unsubFlow();
    unsubAnswers();
  };
}
