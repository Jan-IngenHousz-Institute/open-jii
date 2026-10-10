import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/** An organization's teams with their members. Members only. */
export const useOrganizationTeams = (organizationId: string, options?: { enabled?: boolean }) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationTeams.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.listOrganizationTeams.queryKey({ input }), userId),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
