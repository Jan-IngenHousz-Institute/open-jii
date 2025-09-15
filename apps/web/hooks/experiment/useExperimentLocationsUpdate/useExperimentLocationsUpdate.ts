import { tsr } from "@/lib/tsr";

/**
 * Hook to update locations of an experiment
 * @returns Mutation for updating experiment locations
 */
export const useExperimentLocationsUpdate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.updateExperimentLocations.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate experiment locations queries to refresh the data
      void queryClient.invalidateQueries({
        queryKey: ["experiment-locations", variables.params.id],
      });
    },
  });
};
