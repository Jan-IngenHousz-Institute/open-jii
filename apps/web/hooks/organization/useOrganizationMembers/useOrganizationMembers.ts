import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * The roster plus outside collaborators. Members only, so this doubles as the
 * membership probe for the surface and a 403/404 must not be retried.
 */
export const useOrganizationMembers = (organizationId: string, options?: { enabled?: boolean }) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationMembers.queryOptions({
      input,
      queryKey: withPrincipal(
        orpc.organizations.listOrganizationMembers.queryKey({ input }),
        userId,
      ),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
