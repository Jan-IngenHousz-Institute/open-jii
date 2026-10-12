import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * The decision queue. Owner/admin only, so a 403 is an answer rather than a
 * failure to retry, and callers pass `enabled` when they already know the role.
 */
export const useOrganizationJoinRequests = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationJoinRequests.queryOptions({
      input,
      queryKey: withPrincipal(
        orpc.organizations.listOrganizationJoinRequests.queryKey({ input }),
        userId,
      ),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
