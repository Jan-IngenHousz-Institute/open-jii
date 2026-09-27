import { getReadyPostHogClient } from "./posthog";

type UploadRoute = "mqtt" | "s3" | "unknown";

/**
 * What a researcher's phone does on the way from a scan to data in the lakehouse. Counts and
 * reasons only: no measurement, device or user identifiers. Names follow PostHog's convention,
 * lowercase `category:object_action` with the verb in the present tense.
 */
export interface ProductEvents {
  "measurement:scan_block": {
    reason: "no_device" | "no_protocol" | "protocol_unavailable" | "device_disconnected";
  };
  "measurement:scan_complete": { devices: number; dispatch: boolean };
  "measurement:scan_fail": {
    reason: "disconnected" | "scan_error";
    devices: number;
    dispatch: boolean;
  };
  "measurement:upload_succeed": { route: UploadRoute };
  "measurement:upload_fail": {
    reason: string;
    stage: "terminal" | "retries_exhausted";
    route: UploadRoute;
  };
  "offline_data:prefetch_finish": { status: "ok" | "partial" | "failed"; failures: number };
}

// Events sent before PostHog has started are dropped; these are counts, not a ledger.
export function trackProductEvent<E extends keyof ProductEvents>(
  event: E,
  properties: ProductEvents[E],
): void {
  void getReadyPostHogClient()?.capture(event, { ...properties });
}
