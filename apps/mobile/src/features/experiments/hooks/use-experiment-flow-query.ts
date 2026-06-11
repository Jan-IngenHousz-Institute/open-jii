import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";

export function useExperimentFlowQuery(experimentId: string | undefined) {
  return tsr.experiments.getFlow.useQuery({
    queryKey: contentKeys.experimentFlow(experimentId),
    queryData: { params: { id: experimentId ?? "" } },
    enabled: !!experimentId,
    networkMode: "offlineFirst",
  });
}
