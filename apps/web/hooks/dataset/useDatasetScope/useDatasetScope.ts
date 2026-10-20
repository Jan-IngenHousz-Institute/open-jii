import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetScope = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getDatasetScope.queryOptions({
      input: { id: datasetId },
    }),
  );
};
