import { z } from "zod";

import type { notificationDeliveries } from "@repo/database";

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
 * one round trip per batch. `type` and `resourceType` stay as stored: a build that
 * does not know them cannot render the email and the worker says so on the row.
 */
export interface ClaimedDelivery {
  id: string;
  notificationId: string;
  channel: string;
  status: DeliveryStatus;
  attempts: number;
  recipientId: string;
  type: string;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  params: Record<string, string>;
}
