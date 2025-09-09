import { tsr } from "@/lib/tsr";

export const useExperimentDataUpload = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.uploadExperimentData.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: ["experiments", variables.params.id, "data"],
      });

      // Get the current data
      const previousData = queryClient.getQueryData(["experiments", variables.params.id, "data"]);

      return { previousData };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousData) {
        queryClient.setQueryData(
          ["experiments", variables.params.id, "data"],
          context.previousData,
        );
      }
    },
    onSuccess: async (data) => {
      console.log("Upload success response:", data);
      // Invalidate experiment data queries to refresh data after upload
      await queryClient.invalidateQueries({
        queryKey: ["experiment"],
      });
    },
    onSettled: async (_data, _error, variables) => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["experiments", variables.params.id, "data"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments", variables.params.id],
      });
    },
  });
};
