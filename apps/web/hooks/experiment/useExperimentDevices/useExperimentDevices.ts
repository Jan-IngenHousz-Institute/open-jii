import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Fetch the experiment's devices overview: bound and observed devices with their facts. */
export const useExperimentDevices = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentDevices.queryOptions({ input: { id: experimentId } }),
  );
};
