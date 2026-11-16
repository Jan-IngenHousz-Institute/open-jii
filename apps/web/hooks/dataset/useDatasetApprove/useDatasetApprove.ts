import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";

/** Opens a frozen dataset's page and starts its deposit, and takes it off the queue. */
export const useDatasetApprove = (options: { onSuccess: (dataset: Dataset) => void }) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.datasets.approveDataset.mutationOptions({
      onSuccess: (dataset) => {
        void queryClient.invalidateQueries({ queryKey: orpc.datasets.listReviewQueue.queryKey() });
        options.onSuccess(dataset);
      },
    }),
  );
};
