import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetReview = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getDatasetReview.queryOptions({
      input: { id: datasetId },
    }),
  );
};
