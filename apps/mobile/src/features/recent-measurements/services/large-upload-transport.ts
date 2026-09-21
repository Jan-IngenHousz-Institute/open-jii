import type { PublishMeta, Transport } from "~/features/connection/services/mqtt/mqtt-transport";
import { getApiClient } from "~/shared/api/client";
import { parseMeasurementTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";
import { getTrace } from "~/shared/observability/trace";

import { LargeUploadError } from "./large-upload-errors";
import { LARGE_UPLOAD_TIMEOUT_MS } from "./upload-constants";

const log = createLogger("large-upload");

interface UploadTarget {
  uploadUrl: string;
  key: string;
}

/** oRPC surfaces the HTTP status on the thrown error, as `use-organization` reads it. */
function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const { status } = err;
    if (typeof status === "number") return status;
  }

  return undefined;
}

/**
 * The transport for measurements the broker will not accept. It satisfies the
 * same `Transport` contract as MQTT so the Outbox keeps one queue, one set of
 * row states and one retry schedule; only the wire differs.
 */
class LargeUploadTransportImpl implements Transport {
  private destroyed = false;
  // Held so destroy() can unblock workers awaiting a PUT, the way the MQTT
  // transport rejects its in-flight items.
  private readonly inFlight = new Set<AbortController>();

  async publish(topic: string, payload: object, meta?: PublishMeta): Promise<void> {
    if (this.destroyed) {
      throw new LargeUploadError("Network", "transport destroyed", false);
    }

    const { experimentId } = parseMeasurementTopic(topic);
    if (!experimentId) {
      throw new LargeUploadError("NoExperiment", `topic carries no experiment id: ${topic}`, false);
    }

    const trace = meta?.traceId ? getTrace(meta.traceId) : undefined;
    const body = meta?.serialized ?? JSON.stringify(payload);
    trace?.event("large_upload_start", { bytes: body.length, experiment_id: experimentId });
    log.info("upload start", { experimentId, bytes: body.length });

    const target = await this.requestTarget(experimentId);
    const response = await this.put(target.uploadUrl, body);
    if (response.ok) {
      trace?.event("large_upload_stored", { key: target.key });
      log.info("upload stored", { key: target.key });
      return;
    }

    // A pre-signed URL lasts 15 minutes and a queued row can outlive that. S3
    // answers a stale signature with 403, which one fresh URL resolves.
    if (response.status === 403) {
      trace?.event("large_upload_url_expired");
      const retryTarget = await this.requestTarget(experimentId);
      const retried = await this.put(retryTarget.uploadUrl, body);
      if (retried.ok) {
        trace?.event("large_upload_stored", { key: retryTarget.key, after_refresh: true });
        log.info("upload stored after url refresh", { key: retryTarget.key });
        return;
      }
      throw this.rejected(retried.status);
    }

    throw this.rejected(response.status);
  }

  destroy(): void {
    if (this.destroyed) return;
    log.info("destroy", { inFlight: this.inFlight.size });
    this.destroyed = true;
    for (const controller of this.inFlight) {
      controller.abort();
    }
    this.inFlight.clear();
  }

  private async requestTarget(experimentId: string): Promise<UploadTarget> {
    try {
      return await getApiClient().iot.getUploadUrl({ experimentId });
    } catch (err) {
      const status = statusOf(err);
      if (status === 401) {
        // orpcFetch already refreshed the session and signed the user out by
        // the time a 401 surfaces here, so retrying inside this window cannot help.
        throw new LargeUploadError("Unauthenticated", "session is no longer valid", false, {
          cause: err,
        });
      }
      if (status === 400) {
        throw new LargeUploadError("Rejected", "upload url request was malformed", false, {
          cause: err,
        });
      }
      if (status === 403) {
        throw new LargeUploadError("Forbidden", "not a contributor to this experiment", false, {
          cause: err,
        });
      }
      if (status === 404) {
        throw new LargeUploadError("NotFound", `experiment ${experimentId} not found`, false, {
          cause: err,
        });
      }
      throw new LargeUploadError("Network", "upload url request failed", true, { cause: err });
    }
  }

  private async put(uploadUrl: string, body: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LARGE_UPLOAD_TIMEOUT_MS);
    this.inFlight.add(controller);

    try {
      return await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      throw new LargeUploadError("Network", "upload PUT failed", true, { cause: err });
    } finally {
      clearTimeout(timeout);
      this.inFlight.delete(controller);
    }
  }

  // A throttle or a bad moment in the bucket is worth repeating; any other
  // client error is this request being wrong in a way a repeat will not mend.
  private rejected(status: number): LargeUploadError {
    const worthRepeating = status === 429 || status >= 500;

    return new LargeUploadError("Rejected", `S3 refused the upload (${status})`, worthRepeating);
  }
}

export function createLargeUploadTransport(): Transport {
  return new LargeUploadTransportImpl();
}
