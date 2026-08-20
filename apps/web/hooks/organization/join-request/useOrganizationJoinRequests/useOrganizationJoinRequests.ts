import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * The decision queue. Owner/admin only, so a 403 is an answer rather than a
 * failure to retry, and callers pass `enabled` when they already know the role.
 */
export const useOrganizationJoinRequests = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
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
