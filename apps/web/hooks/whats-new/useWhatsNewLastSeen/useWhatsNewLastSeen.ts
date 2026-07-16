import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Shared query key for the cross-device "last seen" timestamp (the mutation invalidates it). */
export const WHATS_NEW_LAST_SEEN_KEY = orpc.users.getWhatsNewSeen.key();

/**
 * Fetches the current user's What's-new "last seen" timestamp from the backend.
 */
export const useWhatsNewLastSeen = () => {
  return useQuery(
    orpc.users.getWhatsNewSeen.queryOptions({
      staleTime: 5 * 60 * 1000,
    }),
  );
};
