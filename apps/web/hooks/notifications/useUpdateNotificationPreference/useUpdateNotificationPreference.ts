import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

import { notificationPreferencesKey } from "../useNotificationPreferences/useNotificationPreferences";

/** The response is the full resolved set, so it replaces the cached query instead of refetching. */
export const useUpdateNotificationPreference = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation(
    orpc.notifications.updateNotificationPreference.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(notificationPreferencesKey(session?.user.id), data);
      },
    }),
  );
};
