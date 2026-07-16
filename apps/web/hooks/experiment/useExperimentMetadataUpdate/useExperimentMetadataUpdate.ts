import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useExperimentMetadataUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.updateExperimentMetadata.mutationOptions({
      onMutate: async (variables) => {
        const metadataKey = orpc.experiments.listExperimentMetadata.queryKey({
          input: { id: variables.id },
        });
        await queryClient.cancelQueries({ queryKey: metadataKey });
        const previousData = queryClient.getQueryData(metadataKey);
        return { previousData };
      },
      onError: (_error, variables, context) => {
        if (context?.previousData) {
          queryClient.setQueryData(
            orpc.experiments.listExperimentMetadata.queryKey({ input: { id: variables.id } }),
            context.previousData,
          );
        }
      },
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
