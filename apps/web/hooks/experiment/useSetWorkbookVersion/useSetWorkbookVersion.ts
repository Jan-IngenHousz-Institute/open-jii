import { tsr } from "@/lib/tsr";

/**
 * Pin the experiment to a specific existing workbook version (rollback or
 * roll-forward). Mirrors the upgrade hook's invalidation so the design page and
 * the linked-workbook banner react to the new pinned version.
 */
export const useSetWorkbookVersion = (experimentId?: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.setWorkbookVersion.useMutation({
    mutationKey: ["experiment", experimentId, "setWorkbookVersion"],
    onSettled: async (data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["experiment", variables.params.id] });
      await queryClient.invalidateQueries({ queryKey: ["experimentAccess", variables.params.id] });
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
      const workbookId = data?.body.workbookId;
      if (workbookId) {
        await queryClient.invalidateQueries({ queryKey: ["workbook", workbookId] });
        await queryClient.invalidateQueries({ queryKey: ["workbookVersions", workbookId] });
      }
    },
  });
};
