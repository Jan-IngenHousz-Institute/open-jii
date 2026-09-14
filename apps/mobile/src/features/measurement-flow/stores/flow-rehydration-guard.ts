import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

// The flow stores persist under separate AsyncStorage keys, so a kill between
// their writes can leave orphaned answers or snapshots with no active flow.
// Once ALL have hydrated, enforce the invariant: no experimentId means no
// answer history and no stored snapshots. Mounted once at app boot; returns an
// unsubscribe fn.
export function installFlowRehydrationGuard(): () => void {
  const check = () => {
    if (
      !useMeasurementFlowStore.persist.hasHydrated() ||
      !useFlowAnswersStore.persist.hasHydrated() ||
      !useFlowSnapshotsStore.persist.hasHydrated()
    ) {
      return;
    }
    const { experimentId } = useMeasurementFlowStore.getState();
    if (experimentId) return;
    const answers = useFlowAnswersStore.getState();
    if (answers.answersHistory.length > 0) {
      answers.clearHistory();
    }
    const snapshots = useFlowSnapshotsStore.getState();
    if (snapshots.workbookVersionId) {
      snapshots.clear();
    }
  };

  const unsubFlow = useMeasurementFlowStore.persist.onFinishHydration(check);
  const unsubAnswers = useFlowAnswersStore.persist.onFinishHydration(check);
  const unsubSnapshots = useFlowSnapshotsStore.persist.onFinishHydration(check);
  check();
  return () => {
    unsubFlow();
    unsubAnswers();
    unsubSnapshots();
  };
}
