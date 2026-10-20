import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";

/** Starts the publish flow: the server creates a Draft at the experiment's next version. */
export const useDatasetCreate = (options: { onSuccess: (dataset: Dataset) => void }) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.createDataset.mutationOptions({
      onSuccess: (dataset, variables) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.datasets.listExperimentDatasets.queryKey({
            input: { id: variables.id },
          }),
        });
        options.onSuccess(dataset);
      },
    }),
  );
};
