import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";

/** A person's unread count, built the same way for the hook and for the server. */
export function unreadCountQuery(utils: QueryUtils, userId: string | undefined) {
  return utils.notifications.getUnreadNotificationCount.queryOptions({
    queryKey: withPrincipal(orpc.notifications.getUnreadNotificationCount.queryKey(), userId),
  });
}
