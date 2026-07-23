import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetches the experiments where the user is the only admin (the blockers for account deletion),
 * each with its other members as transfer candidates. Used by the delete-account dialog so the
 * user can resolve everything from one spot.
 *
 * @param userId The current user's ID
 * @param options Pass `enabled: false` to defer fetching until the dialog opens
 */
export const useDeletionBlockers = (userId: string, options?: { enabled?: boolean }) => {
  return useQuery(
    orpc.users.getDeletionBlockers.queryOptions({
      input: { id: userId },
      enabled: (options?.enabled ?? true) && userId.length > 0,
    }),
  );
};
