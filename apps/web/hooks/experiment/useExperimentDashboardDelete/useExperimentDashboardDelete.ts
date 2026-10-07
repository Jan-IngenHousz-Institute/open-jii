import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentDashboardList } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

interface ExperimentDashboardDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentDashboardDelete = (props: ExperimentDashboardDeleteProps) => {
  const queryClient = useQueryClient();
  const listKey = orpc.experiments.listExperimentDashboards.key({
    input: { id: props.experimentId },
  });

  return useMutation(
    orpc.experiments.deleteExperimentDashboard.mutationOptions({
      // The row leaves the list at once and comes back if the server refuses.
      onMutate: async ({ dashboardId }) => {
        await queryClient.cancelQueries({ queryKey: listKey });

        const previousLists = queryClient.getQueriesData<ExperimentDashboardList>({
          queryKey: listKey,
        });
        queryClient.setQueriesData<ExperimentDashboardList>({ queryKey: listKey }, (list) =>
          list?.filter((dashboard) => dashboard.id !== dashboardId),
        );

        return { previousLists };
      },
      onError: (_error, _variables, context) => {
        for (const [queryKey, list] of context?.previousLists ?? []) {
          queryClient.setQueryData(queryKey, list);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: listKey });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
