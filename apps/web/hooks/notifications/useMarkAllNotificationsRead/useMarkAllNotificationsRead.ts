import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markCachedNotificationsRead, restoreNotificationCaches } from "../notification-read-cache";
import { NOTIFICATIONS_KEY } from "../useNotifications/useNotifications";

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.notifications.markAllNotificationsRead.mutationOptions({
      onMutate: () => markCachedNotificationsRead(queryClient),
      onError: (_error, _variables, snapshot) => restoreNotificationCaches(queryClient, snapshot),
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      },
    }),
  );
};
