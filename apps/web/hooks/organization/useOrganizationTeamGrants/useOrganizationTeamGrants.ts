import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * What every team of an organization can reach, in one read. Members only, so a
 * refusal is an answer; scoped to the principal like the rest of the surface.
 *
 * The whole organization rather than one team, because the teams grid needs a count
 * on every card at once and a team's own page is a filter over the same answer —
 * which also means opening a team reuses the grid's cache rather than refetching.
 */
export const useOrganizationTeamGrants = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationTeamGrants.queryOptions({
      input,
      queryKey: withPrincipal(
        orpc.organizations.listOrganizationTeamGrants.queryKey({ input }),
        userId,
      ),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
