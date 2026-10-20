import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const usePublicDataset = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getPublicDataset.queryOptions({
      input: { id: datasetId },
    }),
  );
};
