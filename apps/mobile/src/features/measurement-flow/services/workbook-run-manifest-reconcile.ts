import { buildPendingManifest } from "~/features/measurement-flow/domain/workbook-run-manifest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { getOutbox } from "~/shared/composition/upload";
import { saveMeasurementLatest } from "~/shared/db/measurements-storage";
import { getMeasurementMqttTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("workbook-run-manifest");
const CONTROL_PROTOCOL_ID = "workbook-run-complete";

export function workbookRunManifestRowId(attemptId: string): string {
  return `workbook-run-complete:${attemptId}`;
}

let reconcilePromise: Promise<void> | undefined;

function recoverExplicitTerminalReadyAttempt(): void {
  const state = useMeasurementFlowStore.getState();
  const attemptId = state.workbookTerminalReadyAttemptId;
  if (
    !attemptId ||
    attemptId !== state.workbookAttemptId ||
    state.pendingWorkbookRunManifests.some(
      (pending) => pending.record.workbook_attempt_id === attemptId,
    )
  ) {
    return;
  }
  const manifest = buildPendingManifest({
    attemptId,
    workbookVersionId: state.workbookVersionId,
    experimentId: state.experimentId,
    experimentName: state.experimentLabel,
    expected: state.workbookRunExpected,
    realized: state.workbookRunRealized,
  });
  if (!manifest) return;
  useMeasurementFlowStore.setState((current) => ({
    pendingWorkbookRunManifests: [...current.pendingWorkbookRunManifests, manifest],
  }));
}

function enqueueLatestManifest(id: string, changed: boolean): void {
  const outbox = getOutbox();
  if (!changed || !outbox.isProcessing(id)) {
    outbox.enqueue(id);
    return;
  }

  // The replacement is already durable and pending at a newer generation.
  // Re-enqueue it when the old worker releases this id; correctness does not
  // depend on this listener because boot/foreground rehydrate pending rows.
  const subscription: { unsubscribe?: () => void } = {};
  const enqueueReplacement = () => {
    if (outbox.isProcessing(id)) return;
    subscription.unsubscribe?.();
    outbox.enqueue(id);
  };
  subscription.unsubscribe = outbox.subscribeProcessing(id, enqueueReplacement);
  // Close the race where the prior worker settled just before subscription.
  enqueueReplacement();
}

/** Persist pending terminal records into the existing outbox, then acknowledge them. */
export function reconcileWorkbookRunManifests(): Promise<void> {
  if (reconcilePromise) return reconcilePromise;
  reconcilePromise = (async () => {
    recoverExplicitTerminalReadyAttempt();
    while (true) {
      const manifest = useMeasurementFlowStore.getState().pendingWorkbookRunManifests[0];
      if (!manifest) return;

      const attemptId = manifest.record.workbook_attempt_id;
      const id = workbookRunManifestRowId(attemptId);
      try {
        const saved = await saveMeasurementLatest(
          {
            topic: getMeasurementMqttTopic({
              experimentId: manifest.experimentId,
              protocolId: CONTROL_PROTOCOL_ID,
            }),
            measurementResult: manifest.record,
            metadata: {
              experimentName: manifest.experimentName,
              protocolName: "Workbook run",
              timestamp: manifest.createdAt,
            },
          },
          "pending",
          id,
        );
        enqueueLatestManifest(id, saved.changed);
        useMeasurementFlowStore.getState().acknowledgeWorkbookRunManifest(attemptId);
      } catch (error) {
        log.warn("manifest reconcile failed", {
          workbook_attempt_id: attemptId,
          err: (error as Error)?.message,
        });
        return;
      }
    }
  })().finally(() => {
    reconcilePromise = undefined;
  });
  return reconcilePromise;
}

/** Boot reconcile plus live subscription for terminal state transitions. */
export function installWorkbookRunManifestReconcile(): () => void {
  const schedule = () => {
    if (!useMeasurementFlowStore.persist.hasHydrated()) return;
    void reconcileWorkbookRunManifests();
  };
  const unsubscribeHydration = useMeasurementFlowStore.persist.onFinishHydration(schedule);
  const unsubscribeStore = useMeasurementFlowStore.subscribe((state, previous) => {
    if (state.pendingWorkbookRunManifests !== previous.pendingWorkbookRunManifests) schedule();
  });
  schedule();
  return () => {
    unsubscribeHydration();
    unsubscribeStore();
  };
}
