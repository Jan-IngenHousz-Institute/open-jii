import { tsr } from "@/lib/tsr";

export const useUpgradeWorkbookVersion = (experimentId?: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.upgradeWorkbookVersion.useMutation({
    // Keyed so the linked-workbook banner can freeze the "updates available"
    // indicator while an auto-apply upgrade is in flight (avoids a flash).
    mutationKey: ["experiment", experimentId, "upgradeWorkbook"],
    onSettled: async (data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
      const workbookId = data?.body.workbookId;
      if (workbookId) {
        await queryClient.invalidateQueries({ queryKey: ["workbook", workbookId] });
        await queryClient.invalidateQueries({ queryKey: ["workbookVersions", workbookId] });
      }
    },
  });
};
