import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDataset = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getDataset.queryOptions({
      input: { id: datasetId },
    }),
  );
};
