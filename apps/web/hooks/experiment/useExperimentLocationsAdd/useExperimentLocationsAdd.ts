import { tsr } from "@/lib/tsr";

/**
 * Hook to add locations to an experiment
 * @returns Mutation for adding experiment locations
 */
export const useExperimentLocationsAdd = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addExperimentLocations.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate experiment locations queries to refresh the data
      void queryClient.invalidateQueries({
        queryKey: ["experiment-locations", variables.params.id],
      });
    },
  });
};
