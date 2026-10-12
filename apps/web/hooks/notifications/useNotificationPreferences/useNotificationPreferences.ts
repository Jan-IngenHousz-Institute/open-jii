import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

export const notificationPreferencesKey = (userId: string | undefined) =>
  withPrincipal(orpc.notifications.getNotificationPreferences.queryKey(), userId);

export const useNotificationPreferences = () => {
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery(
    orpc.notifications.getNotificationPreferences.queryOptions({
      queryKey: notificationPreferencesKey(session?.user.id),
      enabled: !isSessionPending,
    }),
  );
};
