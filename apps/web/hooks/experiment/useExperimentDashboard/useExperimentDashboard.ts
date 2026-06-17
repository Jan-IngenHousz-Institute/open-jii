import { tsr } from "@/lib/tsr";

export const useExperimentDashboard = (dashboardId: string, experimentId: string) => {
  return tsr.experiments.getExperimentDashboard.useQuery({
    queryData: {
      params: { id: experimentId, dashboardId },
    },
    queryKey: ["experiment-dashboard", experimentId, dashboardId],
  });
};
