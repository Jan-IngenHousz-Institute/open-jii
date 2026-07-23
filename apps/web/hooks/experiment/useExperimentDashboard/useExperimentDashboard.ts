import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentDashboard = (dashboardId: string, experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentDashboard.queryOptions({
      input: { id: experimentId, dashboardId },
    }),
  );
};
