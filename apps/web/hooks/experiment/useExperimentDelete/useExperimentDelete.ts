import { tsr } from "@/lib/tsr";

import type { Experiment } from "@repo/api";

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
        queryKey: ["experiments"],
      });

      // Get the current experiments list
      const previousExperiments = queryClient.getQueryData<{
        body: Experiment[];
      }>(["experiments"]);

      // Optimistically remove the experiment from the list
      if (previousExperiments?.body) {
        queryClient.setQueryData(["experiments"], {
          ...previousExperiments,
          body: previousExperiments.body.filter(
            (experiment) => experiment.id !== variables.params.id,
          ),
        });
      }

      // Remove the single experiment from cache as well
      queryClient.removeQueries({
        queryKey: ["experiment", variables.params.id],
      });

      return { previousExperiments };
    },
    onError: (error, variables, context) => {
      // Restore the previous data if there was an error
      if (context?.previousExperiments) {
        queryClient.setQueryData(["experiments"], context.previousExperiments);
      }
    },
    onSettled: async () => {
      // Always invalidate to ensure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
    },
  });
};
