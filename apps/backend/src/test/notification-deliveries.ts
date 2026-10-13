import { eq, notificationDeliveries, notifications } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

export interface QueuedDelivery {
  notificationId: string;
  type: string;
  channel: string;
  status: string;
}

/**
 * The emails dispatch queued for one person. Dispatch no longer sends, so a producer
 * spec asks for this instead of spying on the adapter; the worker's own spec is what
 * proves a queued row turns into a send.
 */
export function queuedDeliveriesFor(
  database: DatabaseInstance,
  recipientId: string,
): Promise<QueuedDelivery[]> {
  return database
    .select({
      notificationId: notificationDeliveries.notificationId,
      type: notifications.type,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(eq(notifications.recipientId, recipientId));
}
