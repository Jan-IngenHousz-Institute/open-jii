import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";

/** Turns a published dataset into a tombstone and prepares the request to Zenodo. */
export const useDatasetWithdraw = (options: { onSuccess: (dataset: Dataset) => void }) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.withdrawDataset.mutationOptions({
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
