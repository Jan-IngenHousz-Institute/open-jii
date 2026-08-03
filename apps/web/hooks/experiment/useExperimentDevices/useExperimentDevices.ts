import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the devices bound to an experiment.
 */
export const useExperimentDevices = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentDevices.queryOptions({ input: { id: experimentId } }),
  );
};
