import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Takes a dataset back from review to Draft before a data steward has decided. */
export const useDatasetCancelReview = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.cancelDatasetReview.mutationOptions({
      onSuccess: (dataset) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.datasets.listExperimentDatasets.queryKey({
            input: { id: dataset.experimentId },
          }),
        });
      },
    }),
  );
};
