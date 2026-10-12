import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markCachedNotificationsRead, restoreNotificationCaches } from "../notification-read-cache";
import { NOTIFICATIONS_KEY } from "../useNotifications/useNotifications";

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.notifications.markNotificationsRead.mutationOptions({
      onMutate: ({ ids }) => markCachedNotificationsRead(queryClient, ids),
      onError: (_error, _variables, snapshot) => restoreNotificationCaches(queryClient, snapshot),
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      },
    }),
  );
};
