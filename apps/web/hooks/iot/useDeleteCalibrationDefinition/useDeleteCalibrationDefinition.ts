import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteCalibrationDefinitionProps {
  onSuccess?: () => void;
}

export const useDeleteCalibrationDefinition = (props: DeleteCalibrationDefinitionProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.deleteCalibrationDefinition.mutationOptions({
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.iot.listCalibrationDefinitions.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() }),
        ]);
      },
      // The definition's own query is left alone: the page still showing it is mounted until
      // the navigation away lands, and a refetch or rebuild there would 404 into not-found.
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
