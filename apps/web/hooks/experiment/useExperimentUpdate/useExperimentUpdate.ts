import { tsr } from "@/lib/tsr";

import type { Experiment } from "@repo/api";

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
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
    },
  });
};
