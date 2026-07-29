import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Publishes an experiment (private → public) via the dedicated one-way
 * `setVisibility` route. This is a deliberate, irreversible action, kept
 * separate from the general experiment update mutation: the update path
 * no longer carries `visibility`. On success the experiment, its access
 * summary, and the experiment list are invalidated so the now-public state is
 * reflected everywhere.
 */
export const useSetExperimentVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.setVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.queryKey({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
      },
    }),
  );
};
