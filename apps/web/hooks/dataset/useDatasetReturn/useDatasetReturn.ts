import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";

/** Sends a frozen dataset back to Draft with the steward's reason, and takes it off the queue. */
export const useDatasetReturn = (options: { onSuccess: (dataset: Dataset) => void }) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.returnDataset.mutationOptions({
      onSuccess: (dataset) => {
        void queryClient.invalidateQueries({ queryKey: orpc.datasets.listReviewQueue.queryKey() });
        options.onSuccess(dataset);
      },
    }),
  );
};
