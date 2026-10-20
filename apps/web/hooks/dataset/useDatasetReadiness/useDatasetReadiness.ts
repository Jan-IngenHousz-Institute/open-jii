import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetReadiness = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getDatasetReadiness.queryOptions({
      input: { id: datasetId },
    }),
  );
};
