import { getPublisher } from "~/features/connection/services/mqtt/mqtt-publisher";
import { isRetryableMqttError } from "~/features/connection/services/mqtt/mqtt-errors";
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
  if (!row || row.status === "successful") return;

  const payload = {
    ...(row.data.measurementResult as object),
    // Embed the row UUID so an AWS IoT rule can deduplicate on the
    // downstream side if a crash between broker-ack and markAsSuccessful
    // leaves the row "pending" and we re-publish on next boot.
    _client_id: id,
  };

  try {
    await getPublisher().publish(row.data.topic, payload);
    await markAsSuccessful(id);
  } catch (err) {
    if (isRetryableMqttError(err)) {
      // Let AsyncRetryer schedule the next attempt. Don't touch DB state —
      // the row stays at whatever it was (pending or failed) until the
      // queue exhausts retries.
      throw err;
    }
    await markAsFailed(id);
  }
}
