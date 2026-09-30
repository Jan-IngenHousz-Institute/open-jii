import { oc } from "@orpc/contract";

import {
  zListNotificationsQuery,
  zMarkNotificationsReadBody,
  zMarkNotificationsReadResponse,
  zNotificationList,
  zNotificationPreferences,
  zUnreadNotificationCount,
  zUpdateNotificationPreferenceBody,
} from "./notification.schema";

export const notificationContract = {
  listNotifications: oc
    .route({ method: "GET", path: "/api/v1/notifications", successStatus: 200 })
    .input(zListNotificationsQuery)
    .output(zNotificationList),
  getUnreadNotificationCount: oc
    .route({ method: "GET", path: "/api/v1/notifications/unread-count", successStatus: 200 })
    .output(zUnreadNotificationCount),
  markNotificationsRead: oc
    .route({ method: "POST", path: "/api/v1/notifications/read", successStatus: 200 })
    .input(zMarkNotificationsReadBody)
    .output(zMarkNotificationsReadResponse),
  markAllNotificationsRead: oc
    .route({ method: "POST", path: "/api/v1/notifications/read-all", successStatus: 200 })
    .output(zMarkNotificationsReadResponse),
  getNotificationPreferences: oc
    .route({ method: "GET", path: "/api/v1/notifications/preferences", successStatus: 200 })
    .output(zNotificationPreferences),
  updateNotificationPreference: oc
    .route({ method: "PUT", path: "/api/v1/notifications/preferences", successStatus: 200 })
    .input(zUpdateNotificationPreferenceBody)
    .output(zNotificationPreferences),
};
