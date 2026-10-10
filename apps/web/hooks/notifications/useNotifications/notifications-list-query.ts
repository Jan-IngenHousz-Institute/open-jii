import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";

import type { ListNotificationsQuery } from "@repo/api/domains/notification/notification.schema";

/** A page of a person's notifications, built the same way for the hook and for the server. */
export function notificationsListQuery(
  utils: QueryUtils,
  userId: string | undefined,
  input: ListNotificationsQuery,
) {
  return utils.notifications.listNotifications.queryOptions({
    input,
    queryKey: withPrincipal(orpc.notifications.listNotifications.queryKey({ input }), userId),
  });
}
