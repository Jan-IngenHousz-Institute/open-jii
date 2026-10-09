import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";

import type { ListNotificationsQuery } from "@repo/api/domains/notification/notification.schema";

// One page of the most it is allowed to ask for. Filters, day groups and paging
// are OJD-2051; until then the list is what one read returns.
export const NOTIFICATIONS_PAGE_SIZE = 50;

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
