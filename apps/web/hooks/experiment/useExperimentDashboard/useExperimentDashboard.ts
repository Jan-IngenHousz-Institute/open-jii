import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export const useExperimentDashboard = (dashboardId: string, experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentDashboard.queryOptions({
      input: { id: experimentId, dashboardId },
    }),
  );
};
