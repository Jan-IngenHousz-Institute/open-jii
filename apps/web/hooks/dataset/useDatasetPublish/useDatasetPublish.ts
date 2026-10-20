import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";

/** Freezes a Draft: the server writes its files and marks it Published. */
export const useDatasetPublish = (options: { onSuccess: (dataset: Dataset) => void }) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.publishDataset.mutationOptions({
      onSuccess: (dataset) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.datasets.listExperimentDatasets.queryKey({
            input: { id: dataset.experimentId },
          }),
        });
        options.onSuccess(dataset);
      },
    }),
  );
};
