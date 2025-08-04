import { useAsyncCallback } from "react-async-hook";
import { tsr } from "~/api/tsr";
import { mapRowsToMeasurements } from "~/utils/map-rows-to-measurements";

export function useExperimentsData(experimentId: string | undefined, tableName: string) {
  const {
    data,
    error,
    refetch: originalRefetch,
    isFetching: reactQueryIsFetching,
  } = tsr.experiments.getExperimentData.useQuery({
    queryKey: ["experiment-data", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: !!experimentId,
  });

  const refetchAsync = useAsyncCallback(originalRefetch);
  const isFetching = reactQueryIsFetching || refetchAsync.loading;
  const table = data?.body.find((table) => table.name === tableName);

  if (!table?.data) {
    return {
      error,
      refetch: refetchAsync.execute,
      measurements: undefined,
      isFetching,
    };
  }

  const { rows } = table.data;
  const measurements = mapRowsToMeasurements(rows);

  return {
    error,
    refetch: refetchAsync.execute,
    measurements,
    isFetching,
  };
}
