import { isRetryableMqttError } from "~/features/connection/services/mqtt/mqtt-errors";
import { getPublisher } from "~/features/connection/services/mqtt/mqtt-publisher";
import {
  getMeasurementById,
  markAsFailed,
  markAsSuccessful,
} from "~/shared/db/measurements-storage";

// The function the UploadQueue invokes per item. The queue passes the
// measurement ID; the worker is responsible for everything between "read
// row" and "mark final state."
//
// Retry classification:
// - Throw → AsyncRetryer catches, schedules a retry. Used for transient
//   transport errors (Timeout, PublishError) and any non-MqttError.
// - markAsFailed + return → terminal, no retry. Used when the publisher
//   gives up (Disconnected after backoff exhaustion) or rejects on a bad
//   payload / credential failure.
export async function uploadWorker(id: string): Promise<void> {
  const row = await getMeasurementById(id);
  if (!row) {
    console.log("[upload-worker] skip — row gone", { id });
    return;
  }
  if (row.status === "successful") {
    console.log("[upload-worker] skip — already successful", { id });
    return;
  }

  const payload = {
    ...(row.data.measurementResult as object),
    // Embed the row UUID so an AWS IoT rule can deduplicate on the
    // downstream side if a crash between broker-ack and markAsSuccessful
    // leaves the row "pending" and we re-publish on next boot.
    _client_id: id,
  };

  console.log("[upload-worker] publish start", { id, topic: row.data.topic });
  try {
    await getPublisher().publish(row.data.topic, payload);
    await markAsSuccessful(id);
    console.log("[upload-worker] publish ok → marked successful", { id });
  } catch (err) {
    if (isRetryableMqttError(err)) {
      console.warn("[upload-worker] publish failed (retryable) — rethrowing for retry", {
        id,
        kind: (err as { kind?: string })?.kind,
      });
      // Let AsyncRetryer schedule the next attempt. Don't touch DB state —
      // the row stays at whatever it was (pending or failed) until the
      // queue exhausts retries.
      throw err;
    }
    console.error("[upload-worker] publish failed (terminal) — marking failed", {
      id,
      kind: (err as { kind?: string })?.kind,
      err: (err as Error)?.message,
    });
    await markAsFailed(id);
  }
}
