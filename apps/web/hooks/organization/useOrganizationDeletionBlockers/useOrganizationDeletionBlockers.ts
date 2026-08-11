import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * What stands between the organization and deletion, counted across all five owned
 * resource types. Deliberately not the resources showcase: that is scoped to what
 * the caller may read and carries only the four shareable types, so an organization
 * owning nothing but a device reads as empty there while the delete guard refuses it.
 *
 * Owner-only, answering not-found otherwise — which is an answer, not a failure to
 * retry.
 */
export const useOrganizationDeletionBlockers = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
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
