import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

export function experimentDashboardQuery(
  dashboardId: string,
  experimentId: string,
  userId: string | undefined,
) {
  const input = { id: experimentId, dashboardId };
  const key = orpc.experiments.getExperimentDashboard.queryKey({ input });
  return orpc.experiments.getExperimentDashboard.queryOptions({
    input,
    queryKey: withPrincipal(key, userId),
  });
}

export async function reloadExperimentDashboard(
  queryClient: QueryClient,
  query: ReturnType<typeof experimentDashboardQuery>,
) {
  // A detail request started during the PATCH can still return the old widgets.
  await queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
  return queryClient.fetchQuery({ ...query, staleTime: 0 });
}

export const useExperimentDashboard = (dashboardId: string, experimentId: string) => {
  const { userId, isPending } = usePrincipal();
  const query = useQuery({
    ...experimentDashboardQuery(dashboardId, experimentId, userId),
    enabled: !isPending,
  });

  return { ...query, isLoading: query.isPending };
};
