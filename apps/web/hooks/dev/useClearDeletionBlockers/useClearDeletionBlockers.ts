import { tsr } from "@/lib/tsr";

/**
 * Dev-only: removes the account-deletion test experiments seeded for the current user.
 * Invalidates the deletion-blocker and experiment lists so the UI reflects the removal.
 */
export const useClearDeletionBlockers = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.clearDeletionBlockers.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deletion-blockers"] });
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
};
