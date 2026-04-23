import { tsr } from "@/lib/tsr";

/**
 * Hook to upgrade the experiment to the latest workbook version.
 */
export const useUpgradeWorkbookVersion = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.upgradeWorkbookVersion.useMutation({
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
    },
  });
};
