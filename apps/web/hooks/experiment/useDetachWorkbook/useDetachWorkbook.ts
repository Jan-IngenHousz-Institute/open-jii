import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

export const useDetachWorkbook = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.detachWorkbook.mutationOptions({
      // The design page drops to its empty state at once, and gets the link back if the server
      // refuses. Detach has no workbookId in its response, so it is read from the cache here.
      onMutate: async (variables) => {
        const experimentKey = orpc.experiments.getExperiment.queryKey({
          input: { id: variables.id },
        });
        await queryClient.cancelQueries({ queryKey: experimentKey });

        const previousExperiment = queryClient.getQueryData<Experiment>(experimentKey);
        if (previousExperiment) {
          queryClient.setQueryData<Experiment>(experimentKey, {
            ...previousExperiment,
            workbookId: null,
          });
        }

        return { previousExperiment, workbookId: previousExperiment?.workbookId ?? undefined };
      },
      onError: (_error, variables, context) => {
        if (context?.previousExperiment) {
          queryClient.setQueryData(
            orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
            context.previousExperiment,
          );
        }
      },
      onSettled: async (_data, _error, variables, context) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.key({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.key({ input: { id: variables.id } }),
        });
        for (const queryKey of listQueryKeys.experiments()) {
          await queryClient.invalidateQueries({ queryKey });
        }
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
