import { tsr } from "@/lib/tsr";

export const useExperimentMetadataUpsert = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.upsertExperimentMetadata.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["experiment", variables.params.id, "metadata"],
      });
      const previousData = queryClient.getQueryData([
        "experiment",
        variables.params.id,
        "metadata",
      ]);
      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["experiment", variables.params.id, "metadata"],
          context.previousData,
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id, "metadata"],
      });
    },
  });
};
