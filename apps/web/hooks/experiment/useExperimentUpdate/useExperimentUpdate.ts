import { Experiment, UpdateExperimentBody } from "@repo/api";

import { tsr } from "../../../lib/tsr";

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
        queryKey: ["experiment", variables.params.id, variables.query.userId],
      });

      // Get the current experiment data
      const previousExperiment = queryClient.getQueryData<{
        body: Experiment;
      }>(["experiment", variables.params.id, variables.query.userId]);

      // Optimistically update the cache
      if (previousExperiment) {
        queryClient.setQueryData(
          ["experiment", variables.params.id, variables.query.userId],
          {
            ...previousExperiment,
            body: {
              ...previousExperiment.body,
              ...variables.body,
            },
          },
        );
      }

      // Also update in any experiment lists in the cache
      const experimentsKey = ["experiments", variables.query.userId];
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
        queryClient.setQueryData(
          ["experiment", variables.params.id, variables.query.userId],
          context.previousExperiment,
        );
      }

      if (context?.previousExperiments) {
        queryClient.setQueryData(
          ["experiments", variables.query.userId],
          context.previousExperiments,
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id, variables.query.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["experiments", variables.query.userId],
      });
    },
  });
};
