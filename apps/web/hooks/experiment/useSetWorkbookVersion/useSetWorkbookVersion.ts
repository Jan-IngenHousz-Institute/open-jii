import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Pin the experiment to a specific existing workbook version (rollback or
 * roll-forward). Mirrors the upgrade hook's invalidation so the design page and
 * the linked-workbook banner react to the new pinned version.
 */
export const useSetWorkbookVersion = (experimentId?: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.setWorkbookVersion.mutationOptions({
      mutationKey: ["experiment", experimentId, "setWorkbookVersion"],
      onSettled: async (data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.key({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.key({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
        const workbookId = data?.workbookId;
        if (workbookId) {
          await queryClient.invalidateQueries({
            queryKey: orpc.workbooks.getWorkbook.key({ input: { id: workbookId } }),
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.workbooks.listWorkbookVersions.key({ input: { id: workbookId } }),
          });
        }
      },
    }),
  );
};
