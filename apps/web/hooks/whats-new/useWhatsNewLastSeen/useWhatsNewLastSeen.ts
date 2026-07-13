import { tsr } from "@/lib/tsr";

/** Shared query key for the cross-device "last seen" timestamp (the mutation invalidates it). */
export const WHATS_NEW_LAST_SEEN_KEY = ["whats-new", "last-seen"];

/**
 * Fetches the current user's What's-new "last seen" timestamp from the backend.
 * Thin ts-rest query wrapper, matching the rest of apps/web/hooks (e.g. useCommand, useUserSearch).
 */
export const useWhatsNewLastSeen = () => {
  return tsr.users.getWhatsNewSeen.useQuery({
    queryKey: WHATS_NEW_LAST_SEEN_KEY,
    staleTime: 5 * 60 * 1000,
  });
};
