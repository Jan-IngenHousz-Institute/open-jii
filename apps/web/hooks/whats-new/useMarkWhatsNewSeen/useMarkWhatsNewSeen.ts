import { tsr } from "@/lib/tsr";

import { WHATS_NEW_LAST_SEEN_KEY } from "../useWhatsNewLastSeen/useWhatsNewLastSeen";

/**
 * Marks What's-new as seen — stamps now() on the backend (cross-device) and refetches the
 * last-seen query so the unread dot clears everywhere.
 */
export const useMarkWhatsNewSeen = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.markWhatsNewSeen.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: WHATS_NEW_LAST_SEEN_KEY });
    },
  });
};
