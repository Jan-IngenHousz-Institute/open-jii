import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetFlaggedReadings = (datasetId: string) => {
  return useQuery(
    orpc.datasets.listDatasetFlaggedReadings.queryOptions({
      input: { id: datasetId },
    }),
  );
};
