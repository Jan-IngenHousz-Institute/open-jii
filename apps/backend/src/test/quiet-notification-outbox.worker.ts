import { Injectable } from "@nestjs/common";

import { NotificationOutboxWorker } from "../notifications/application/services/notification-outbox.worker";

/**
 * The harness boots the whole application, so the real loop would run through the
 * suite and send rows other specs had only queued, and nothing would be left for
 * their assertions. `drain()` stays real — specs call it by hand.
 */
@Injectable()
export class QuietNotificationOutboxWorker extends NotificationOutboxWorker {
  // The schedule explorer reads the decorator's metadata off the instance's own
  // method, and an override carries none, so the interval is never registered.
  override async drainOnSchedule(): Promise<void> {
    return Promise.resolve();
  }

  override nudge(): void {
    // Dispatch still calls it, and the dispatch spec still proves the call.
  }
}
