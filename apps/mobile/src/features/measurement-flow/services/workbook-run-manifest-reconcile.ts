import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { getOutbox } from "~/shared/composition/upload";
import { saveMeasurementIdempotently } from "~/shared/db/measurements-storage";
import { getMeasurementMqttTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("workbook-run-manifest");
const CONTROL_PROTOCOL_ID = "workbook-run-complete";

export function workbookRunManifestRowId(attemptId: string): string {
  return `workbook-run-complete:${attemptId}`;
}

let reconcilePromise: Promise<void> | undefined;

/** Persist pending terminal records into the existing outbox, then acknowledge them. */
export function reconcileWorkbookRunManifests(): Promise<void> {
  if (reconcilePromise) return reconcilePromise;
  reconcilePromise = (async () => {
    while (true) {
      const manifest = useMeasurementFlowStore.getState().pendingWorkbookRunManifests[0];
      if (!manifest) return;

      const attemptId = manifest.record.workbook_attempt_id;
      const id = workbookRunManifestRowId(attemptId);
      try {
        await saveMeasurementIdempotently(
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
        getOutbox().enqueue(id);
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
