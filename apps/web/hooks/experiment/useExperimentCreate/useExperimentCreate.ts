import { Experiment } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to create a new experiment
 * @returns Mutation object for creating experiments
 */
export const useExperimentCreate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createExperiment.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["experiments"] });

      // Get the current experiments
      const previousExperiments = queryClient.getQueryData<{
        body: Experiment[];
      }>(["experiments", variables.query.userId]);

      // Return the previous experiments to use in case of error
      return { previousExperiments };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousExperiments) {
        queryClient.setQueryData(
          ["experiments", variables.query.userId],
          context.previousExperiments,
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to make sure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: ["experiments", variables.query.userId],
      });
    },
  });
};
