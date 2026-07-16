import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ExperimentDashboardDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentDashboardDelete = (props: ExperimentDashboardDeleteProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.deleteExperimentDashboard.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentDashboards.key({
            input: { id: props.experimentId },
          }),
        });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
