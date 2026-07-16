import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { WHATS_NEW_LAST_SEEN_KEY } from "../useWhatsNewLastSeen/useWhatsNewLastSeen";

/**
 * Marks What's-new as seen — stamps now() on the backend (cross-device) and refetches the
 * last-seen query so the unread dot clears everywhere.
 */
export const useMarkWhatsNewSeen = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.markWhatsNewSeen.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: WHATS_NEW_LAST_SEEN_KEY });
      },
    }),
  );
};
