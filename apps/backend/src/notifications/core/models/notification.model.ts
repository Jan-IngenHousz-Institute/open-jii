import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { notificationPreferences } from "@repo/database";

export const selectNotificationPreferenceSchema = createSelectSchema(notificationPreferences);

export type NotificationPreferenceRowDto = z.infer<typeof selectNotificationPreferenceSchema>;

/** The contract's notification with the timestamps still as dates; `formatDates` converts them. */
export type NotificationDto = Omit<Notification, "readAt" | "createdAt"> & {
  readAt: Date | null;
  createdAt: Date;
};
