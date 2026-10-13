import { orpc } from "@/lib/orpc";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { NotificationList } from "@repo/api/domains/notification/notification.schema";

import { NOTIFICATIONS_KEY } from "./useNotifications/useNotifications";

export type NotificationCacheSnapshot = [QueryKey, unknown][];

/**
 * Shows notifications as read before the server confirms: cached lists mark them and the unread
 * badge drops by as many as were unread. Without `ids`, every notification is marked. Returns
 * what to put back if the request fails.
 */
export async function markCachedNotificationsRead(
  queryClient: QueryClient,
  ids?: string[],
): Promise<NotificationCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
  const snapshot = queryClient.getQueriesData({ queryKey: NOTIFICATIONS_KEY });

  const listKey = orpc.notifications.listNotifications.key();
  const isMarked = (id: string) => !ids || ids.includes(id);
  const newlyRead = new Set(
    queryClient
      .getQueriesData<NotificationList>({ queryKey: listKey })
      .flatMap(([, list]) => list?.items ?? [])
      .filter((notification) => notification.readAt === null && isMarked(notification.id))
      .map((notification) => notification.id),
  );

  const readAt = new Date().toISOString();
  queryClient.setQueriesData<NotificationList>({ queryKey: listKey }, (list) =>
    list
      ? {
          ...list,
          items: list.items.map((notification) =>
            newlyRead.has(notification.id) ? { ...notification, readAt } : notification,
          ),
        }
      : list,
  );
  queryClient.setQueriesData<{ count: number }>(
    { queryKey: orpc.notifications.getUnreadNotificationCount.key() },
    (unread) => (unread ? { count: ids ? Math.max(0, unread.count - newlyRead.size) : 0 } : unread),
  );

  return snapshot;
}

export function restoreNotificationCaches(
  queryClient: QueryClient,
  snapshot: NotificationCacheSnapshot | undefined,
) {
  for (const [queryKey, data] of snapshot ?? []) {
    queryClient.setQueryData(queryKey, data);
  }
}
