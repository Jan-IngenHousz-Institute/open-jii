import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to update locations of an experiment
 * @returns Mutation for updating experiment locations
 */
export const useExperimentLocationsUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.updateExperimentLocations.mutationOptions({
      onSuccess: (_data, variables) => {
        // Invalidate experiment locations queries to refresh the data
        void queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentLocations.queryKey({
            input: { id: variables.id },
          }),
        });
      },
    }),
  );
};
