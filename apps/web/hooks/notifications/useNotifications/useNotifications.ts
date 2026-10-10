import { usePrincipal } from "@/components/auth/principal-context";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ListNotificationsQuery } from "@repo/api/domains/notification/notification.schema";

import { notificationsListQuery } from "./notifications-list-query";

/** Every notification query shares this prefix, so a read-state change can refresh them all. */
export const NOTIFICATIONS_KEY = orpc.notifications.key();

export const useNotifications = (
  input: ListNotificationsQuery,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery({
    ...notificationsListQuery(orpc, userId, input),
    enabled: (options?.enabled ?? true) && !isSessionPending,
    placeholderData: (previous) => previous,
  });
};
