import { z } from "zod";

import type { notificationDeliveries, notifications } from "@repo/database";

export const DELIVERY_STATUSES = ["pending", "sending", "sent", "failed"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The column is text, so a row read back is narrowed here rather than trusted. */
export const zDeliveryStatus = z.enum(DELIVERY_STATUSES);

/** The channel a delivery goes out on; push lands here when it exists. */
export const DELIVERY_CHANNEL_EMAIL = "email";

export type NotificationDeliveryRow = Omit<typeof notificationDeliveries.$inferSelect, "status"> & {
  status: DeliveryStatus;
};

export interface NotificationDeliveryInsertRow {
  notificationId: string;
  channel: string;
}

/**
 * A claimed row with everything the email needs reachable from it, so a drain makes
 * one round trip per claim. `type` and `resourceType` stay as stored: a build that
 * does not know them cannot render the email and the worker says so on the row.
 *
 * `claimedAt` is what every later write on this row is fenced against, so it is
 * non-null here: a row that came back from a claim was stamped by it.
 */
export type ClaimedDelivery = Pick<
  NotificationDeliveryRow,
  "id" | "notificationId" | "channel" | "status" | "attempts" | "claimedAt"
> & { claimedAt: Date } & Pick<
    typeof notifications.$inferSelect,
    "recipientId" | "type" | "actorId" | "resourceType" | "resourceId" | "params"
  >;
