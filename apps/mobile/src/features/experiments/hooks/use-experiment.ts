import { tsr } from "~/api/tsr";

export function useExperiment(experimentId: string | undefined) {
  const { data, isLoading, error } = tsr.experiments.getExperiment.useQuery({
    queryKey: ["experiment", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: !!experimentId,
  });

  const experiment = data?.body;

  return {
    experiment,
    isLoading,
    error,
  };
}
