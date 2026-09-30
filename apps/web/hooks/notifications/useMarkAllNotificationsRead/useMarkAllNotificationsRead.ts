import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { NOTIFICATIONS_KEY } from "../useNotifications/useNotifications";

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.notifications.markAllNotificationsRead.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      },
    }),
  );
};
