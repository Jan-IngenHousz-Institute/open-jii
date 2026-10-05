import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ListNotificationsQuery } from "@repo/api/domains/notification/notification.schema";

/** Every notification query shares this prefix, so a read-state change can refresh them all. */
export const NOTIFICATIONS_KEY = orpc.notifications.key();

export const useNotifications = (
  input: ListNotificationsQuery,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery(
    orpc.notifications.listNotifications.queryOptions({
      input,
      queryKey: withPrincipal(orpc.notifications.listNotifications.queryKey({ input }), userId),
      enabled: (options?.enabled ?? true) && !isSessionPending,
      placeholderData: (previous) => previous,
    }),
  );
};
