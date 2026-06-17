import { tsr } from "@/lib/tsr";

interface ExperimentDashboardDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentDashboardDelete = (props: ExperimentDashboardDeleteProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteExperimentDashboard.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment-dashboards", props.experimentId],
      });
    },
    onSuccess: () => {
      props.onSuccess?.();
    },
  });
};
