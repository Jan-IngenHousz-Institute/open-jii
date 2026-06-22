import { tsr } from "@/lib/tsr";

/**
 * Fetches the experiments where the user is the only admin (the blockers for account deletion),
 * each with its other members as transfer candidates. Used by the delete-account dialog so the
 * user can resolve everything from one spot.
 *
 * @param userId The current user's ID
 * @param options Pass `enabled: false` to defer fetching until the dialog opens
 */
export const useDeletionBlockers = (userId: string, options?: { enabled?: boolean }) => {
  return tsr.users.getDeletionBlockers.useQuery({
    queryData: { params: { id: userId } },
    queryKey: ["deletion-blockers", userId],
    enabled: (options?.enabled ?? true) && userId.length > 0,
  });
};
