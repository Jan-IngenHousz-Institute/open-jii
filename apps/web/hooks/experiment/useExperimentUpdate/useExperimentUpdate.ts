import { tsr } from "@/lib/tsr";

import type { Experiment } from "@repo/api/schemas/experiment.schema";

/**
 * Hook to update an existing experiment
 * @returns Mutation object for updating experiments
 */
export const useExperimentUpdate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.updateExperiment.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwrites
      await queryClient.cancelQueries({
        queryKey: ["experiment", variables.params.id],
      });

      // Get the current experiment data
      const previousExperiment = queryClient.getQueryData<{
        body: Experiment;
      }>(["experiment", variables.params.id]);

      // Optimistically update the cache
      if (previousExperiment) {
        queryClient.setQueryData(["experiment", variables.params.id], {
          ...previousExperiment,
          body: {
            ...previousExperiment.body,
            ...variables.body,
          },
        });
      }

      // Also update in any experiment lists in the cache
      const experimentsKey = ["experiments"];
      const previousExperiments = queryClient.getQueryData<{
        body: Experiment[];
      }>(experimentsKey);

      if (previousExperiments?.body) {
        queryClient.setQueryData(experimentsKey, {
          ...previousExperiments,
          body: previousExperiments.body.map((experiment) =>
            experiment.id === variables.params.id
              ? { ...experiment, ...variables.body }
              : experiment,
          ),
        });
      }

      return { previousExperiment, previousExperiments };
    },
    onError: (error, variables, context) => {
      // Revert updates on error
      if (context?.previousExperiment) {
        queryClient.setQueryData(["experiment", variables.params.id], context.previousExperiment);
      }

      if (context?.previousExperiments) {
        queryClient.setQueryData(["experiments"], context.previousExperiments);
      }
    },
    onSettled: async (data, error, variables) => {
      // Always refetch after error or success
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });

      // Toggling contributor anonymization re-pseudonymizes distinct values
      // and row data server-side; drop the cached reads so filters and
      // charts reflect the new state without a hard refresh.
      if (variables.body?.anonymizeContributors !== undefined) {
        // Both caches key on the experiment id, so scope the prefix to it.
        await queryClient.invalidateQueries({
          queryKey: ["experiment-distinct-values", variables.params.id],
        });
        await queryClient.invalidateQueries({
          queryKey: ["experiment-visualization-data", variables.params.id],
        });
      }
    },
  });
};
