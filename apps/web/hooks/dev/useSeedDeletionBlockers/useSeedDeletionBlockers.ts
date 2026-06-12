import { tsr } from "@/lib/tsr";

/**
 * Dev-only: seeds account-deletion test experiments (every case) for the current user.
 * Invalidates the deletion-blocker and experiment lists so the UI reflects the new data.
 */
export const useSeedDeletionBlockers = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.seedDeletionBlockers.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deletion-blockers"] });
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
};
