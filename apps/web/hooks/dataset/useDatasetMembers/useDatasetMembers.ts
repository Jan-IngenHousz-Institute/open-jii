import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetMembers = (datasetId: string) => {
  return useQuery(
    orpc.datasets.listDatasetMembers.queryOptions({
      input: { id: datasetId },
    }),
  );
};
