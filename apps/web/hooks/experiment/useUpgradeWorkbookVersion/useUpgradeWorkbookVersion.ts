import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useUpgradeWorkbookVersion = (experimentId?: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.upgradeWorkbookVersion.mutationOptions({
      // Keyed so the linked-workbook banner can freeze the "updates available"
      // indicator while an auto-apply upgrade is in flight (avoids a flash).
      mutationKey: ["experiment", experimentId, "upgradeWorkbook"],
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
