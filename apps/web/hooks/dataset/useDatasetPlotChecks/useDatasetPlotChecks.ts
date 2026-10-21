import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useDatasetPlotChecks = (datasetId: string) => {
  return useQuery(
    orpc.datasets.getDatasetPlotChecks.queryOptions({
      input: { id: datasetId },
    }),
  );
};
