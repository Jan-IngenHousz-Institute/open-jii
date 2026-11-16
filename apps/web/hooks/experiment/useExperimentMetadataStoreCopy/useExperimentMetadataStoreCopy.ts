import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useExperimentMetadataStoreCopy = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.copyExperimentMetadataToStore.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentMetadata.queryKey({
            input: { id: variables.id },
          }),
        });
      },
    }),
  );
};
