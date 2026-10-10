import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentVisualizationList } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

interface ExperimentVisualizationDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentVisualizationDelete = (props: ExperimentVisualizationDeleteProps) => {
  const queryClient = useQueryClient();
  const listKey = orpc.experiments.listExperimentVisualizations.key({
    input: { id: props.experimentId },
  });

  return useMutation(
    orpc.experiments.deleteExperimentVisualization.mutationOptions({
      onMutate: async ({ visualizationId }) => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: listKey });

        const previousLists = queryClient.getQueriesData<ExperimentVisualizationList>({
          queryKey: listKey,
        });
        queryClient.setQueriesData<ExperimentVisualizationList>({ queryKey: listKey }, (list) =>
          list?.filter((visualization) => visualization.id !== visualizationId),
        );

        return { previousLists };
      },
      onError: (_error, _variables, context) => {
        for (const [queryKey, list] of context?.previousLists ?? []) {
          queryClient.setQueryData(queryKey, list);
        }
      },
      onSettled: async () => {
        // Always refetch after error or success to make sure cache is in sync with server
        await queryClient.invalidateQueries({ queryKey: listKey });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
