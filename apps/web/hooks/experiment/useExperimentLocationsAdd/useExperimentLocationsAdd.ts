import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to add locations to an experiment
 * @returns Mutation for adding experiment locations
 */
export const useExperimentLocationsAdd = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.addExperimentLocations.mutationOptions({
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
