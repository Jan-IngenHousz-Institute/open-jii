import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

export function useExperiment(experimentId: string | undefined) {
  const { data, isLoading, error } = useQuery(
    orpc.experiments.getExperiment.queryOptions({
      input: { id: experimentId ?? "" },
      enabled: !!experimentId,
      networkMode: "offlineFirst",
    }),
  );

  return {
    experiment: data,
    isLoading,
    error,
  };
}
