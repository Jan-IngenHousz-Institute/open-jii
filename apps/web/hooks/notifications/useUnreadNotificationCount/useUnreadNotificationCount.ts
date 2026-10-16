import { usePrincipal } from "@/components/auth/principal-context";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { unreadCountQuery } from "./unread-count-query";

const POLL_INTERVAL_MS = 60_000;

/** Polled rather than pushed; a minute is soon enough for anything a notification carries. */
export const useUnreadNotificationCount = () => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery({
    ...unreadCountQuery(orpc, userId),
    enabled: !isSessionPending,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
};
