import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentLayoutPlacements = (
  experimentId: string,
  filter: { deviceId?: string; plotId?: string },
) => {
  return useQuery(
    orpc.experiments.listLayoutPlacements.queryOptions({
      input: { id: experimentId, ...filter },
    }),
  );
};
