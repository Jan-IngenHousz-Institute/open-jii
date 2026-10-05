import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * What stands between the organization and deletion, counted across every owned
 * resource type. Deliberately not the resources showcase: that is scoped to what the
 * caller may read, so an organization whose remaining resources are all private to
 * someone else reads as empty there while the delete guard refuses it.
 *
 * Owner-only, answering not-found otherwise — which is an answer, not a failure to
 * retry.
 */
export const useOrganizationDeletionBlockers = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.getOrganizationDeletionBlockers.queryOptions({
      input,
      queryKey: withPrincipal(
        orpc.organizations.getOrganizationDeletionBlockers.queryKey({ input }),
        userId,
      ),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
