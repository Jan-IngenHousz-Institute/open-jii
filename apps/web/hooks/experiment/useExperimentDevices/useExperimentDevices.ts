import { tsr } from "@/lib/tsr";

/**
 * Fetch the devices bound to an experiment.
 */
export const useExperimentDevices = (experimentId: string) => {
  return tsr.experiments.listExperimentDevices.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-devices", experimentId],
  });
};
