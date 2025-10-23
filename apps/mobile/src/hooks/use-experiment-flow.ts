import { tsr } from "~/api/tsr";

export function useExperimentFlow(experimentId: string | undefined) {
  return tsr.experiments.getFlow.useQuery({
    queryKey: ["experiment-flow", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: !!experimentId,
  });
}
