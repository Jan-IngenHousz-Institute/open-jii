import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const POLL_INTERVAL_MS = 60_000;

/** Polled rather than pushed; a minute is soon enough for anything a notification carries. */
export const useUnreadNotificationCount = () => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery(
    orpc.notifications.getUnreadNotificationCount.queryOptions({
      queryKey: withPrincipal(orpc.notifications.getUnreadNotificationCount.queryKey(), userId),
      enabled: !isSessionPending,
      refetchInterval: POLL_INTERVAL_MS,
      refetchOnWindowFocus: true,
    }),
  );
};
