import { tsr } from "~/shared/api/tsr";

export function useExperimentFlowQuery(experimentId: string | undefined) {
  return tsr.experiments.getFlow.useQuery({
    queryKey: ["experiment-flow", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: !!experimentId,
    networkMode: "offlineFirst",
  });
}
