import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDetachWorkbook = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.detachWorkbook.mutationOptions({
      // Detach has no workbookId in its response; read it from the experiment cache.
      onMutate: (variables) => {
        const experiment = queryClient.getQueryData(
          orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
        );
        return { workbookId: experiment?.workbookId ?? undefined };
      },
      onSettled: async (_data, _error, variables, context) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.key({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.key({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
        const workbookId = context?.workbookId;
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
