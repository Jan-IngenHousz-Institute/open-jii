import { tsr } from "@/lib/tsr";

/**
 * Bulk-transfers experiment admin rights to other users (one target per experiment). Used to clear
 * account-deletion blockers in a single call. Invalidates the deletion-blocker and member caches so
 * resolved experiments drop out of the delete dialog automatically.
 */
export const useTransferExperimentAdmin = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.transferExperimentAdmin.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deletion-blockers"] });
      await queryClient.invalidateQueries({ queryKey: ["experiment-members"] });
    },
  });
};
