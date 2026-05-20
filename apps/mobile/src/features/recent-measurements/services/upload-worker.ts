import { isRetryableMqttError } from "~/features/connection/services/mqtt/mqtt-errors";
import { getPublisher } from "~/features/connection/services/mqtt/mqtt-publisher";
import {
  getMeasurementById,
  markAsFailed,
  markAsSuccessful,
} from "~/shared/db/measurements-storage";
import { createLogger } from "~/shared/utils/logger";
import { getTrace } from "~/shared/utils/trace";

const log = createLogger("upload-worker");

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
  const trace = getTrace(id);
  const row = await getMeasurementById(id);
  if (!row) {
    log.info("skip — row gone", { id });
    trace?.end("ok", { skipped: "row_gone" });
    return;
  }
  if (row.status === "successful") {
    log.info("skip — already successful", { id });
    trace?.end("ok", { skipped: "already_successful" });
    return;
  }

  const payload = {
    ...(row.data.measurementResult as object),
    // Embed the row UUID so an AWS IoT rule can deduplicate on the
    // downstream side if a crash between broker-ack and markAsSuccessful
    // leaves the row "pending" and we re-publish on next boot.
    _client_id: id,
  };

  trace?.setFields({ topic: row.data.topic, row_status_before: row.status });
  trace?.event("publish_start");
  log.info("publish start", { id, topic: row.data.topic });
  try {
    await getPublisher().publish(row.data.topic, payload, { traceId: id });
    await markAsSuccessful(id);
    trace?.event("marked_successful");
    trace?.end("ok");
    log.info("publish ok → marked successful", { id });
  } catch (err) {
    const kind = (err as { kind?: string })?.kind;
    if (isRetryableMqttError(err)) {
      log.warn("publish failed (retryable) — rethrowing for retry", { id, kind });
      trace?.event("publish_failed_retryable", { kind });
      // Let AsyncRetryer schedule the next attempt. Don't touch DB state —
      // the row stays at whatever it was (pending or failed) until the
      // queue exhausts retries. Trace stays open so the next attempt
      // accumulates onto the same canonical event.
      throw err;
    }
    log.error("publish failed (terminal) — marking failed", {
      id,
      kind,
      err: (err as Error)?.message,
    });
    await markAsFailed(id);
    trace?.event("marked_failed", { kind });
    trace?.end("error", { err: (err as Error)?.message, kind });
  }
}
