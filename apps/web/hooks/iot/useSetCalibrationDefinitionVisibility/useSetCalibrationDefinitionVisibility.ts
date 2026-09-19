import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Publishes a calibration definition (private → public). One way, like every other
 * publish route: the invalidation reaches the definition itself, the library listing and
 * global search, because a published method is meant to be found by people who were never
 * granted it.
 */
export const useSetCalibrationDefinitionVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.setCalibrationDefinitionVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.iot.getCalibrationDefinition.key({
            input: { definitionId: variables.definitionId },
          }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.iot.listCalibrationDefinitions.key(),
        });
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
