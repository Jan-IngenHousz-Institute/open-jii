import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function experimentDashboardQuery(dashboardId: string, experimentId: string) {
  return orpc.experiments.getExperimentDashboard.queryOptions({
    input: { id: experimentId, dashboardId },
  });
}

export const useExperimentDashboard = (dashboardId: string, experimentId: string) => {
  return useQuery(experimentDashboardQuery(dashboardId, experimentId));
};
