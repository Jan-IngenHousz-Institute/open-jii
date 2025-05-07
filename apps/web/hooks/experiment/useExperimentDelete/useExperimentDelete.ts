import { Experiment } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to delete an experiment
 * @returns Mutation object for deleting experiments
 */
export const useExperimentDelete = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteExperiment.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["experiments", variables.query.userId],
      });

      // Get the current experiments list
      const previousExperiments = queryClient.getQueryData<{
        body: Experiment[];
      }>(["experiments", variables.query.userId]);

      // Optimistically remove the experiment from the list
      if (previousExperiments?.body) {
        queryClient.setQueryData(["experiments", variables.query.userId], {
          ...previousExperiments,
          body: previousExperiments.body.filter(
            (experiment) => experiment.id !== variables.params.id,
          ),
        });
      }

      // Remove the single experiment from cache as well
      queryClient.removeQueries({
        queryKey: ["experiment", variables.params.id, variables.query.userId],
      });

      return { previousExperiments };
    },
    onError: (error, variables, context) => {
      // Restore the previous data if there was an error
      if (context?.previousExperiments) {
        queryClient.setQueryData(
          ["experiments", variables.query.userId],
          context.previousExperiments,
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always invalidate to ensure cache is in sync with server
      queryClient.invalidateQueries({
        queryKey: ["experiments", variables.query.userId],
      });
    },
  });
};
