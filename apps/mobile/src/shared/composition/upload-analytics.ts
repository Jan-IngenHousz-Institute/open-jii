import type { Outbox } from "~/features/recent-measurements/services/outbox";
import { trackProductEvent } from "~/shared/observability/product-events";

/**
 * Counts every upload the outbox finishes, with why a failure failed, so the phone's side of the
 * data path is visible next to what arrives in the lakehouse. The outbox itself stays unaware.
 */
export function mountUploadAnalytics(outbox: Pick<Outbox, "subscribeSettled">): () => void {
  return outbox.subscribeSettled((items) => {
    for (const item of items) {
      if (item.status === "successful") {
        trackProductEvent("measurement:upload_succeed", { route: item.route ?? "unknown" });
      } else {
        trackProductEvent("measurement:upload_fail", {
          reason: item.reason ?? "unknown",
          stage: item.stage ?? "terminal",
          route: item.route ?? "unknown",
        });
      }
    }
  });
}
