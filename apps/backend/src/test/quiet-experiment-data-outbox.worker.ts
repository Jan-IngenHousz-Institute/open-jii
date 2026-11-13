import { Injectable } from "@nestjs/common";

import { ExperimentDataOutboxWorker } from "../experiments/application/services/experiment-data-outbox.worker";

/**
 * The harness boots the whole application, so the real loop would copy rows other specs had only
 * queued. `drain()` stays real; specs call it by hand.
 */
@Injectable()
export class QuietExperimentDataOutboxWorker extends ExperimentDataOutboxWorker {
  // The schedule explorer reads the decorator's metadata off the instance's own method, and an
  // override carries none, so the interval is never registered.
  override async drainOnSchedule(): Promise<void> {
    return Promise.resolve();
  }

  override nudge(): void {
    // Writes still call it, and their specs still prove the call.
  }
}
