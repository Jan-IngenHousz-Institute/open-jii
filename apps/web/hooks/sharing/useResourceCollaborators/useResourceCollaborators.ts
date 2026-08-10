import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * The share-gated endpoint doubles as the surface's capability probe, and 4xx
 * responses are not retried. Principal-scoped keys plus waiting for the session
 * prevent a new user from briefly seeing the previous user's collaborator list.
 */
export const useResourceCollaborators = (
  resourceType: SharingResourceType,
  resourceId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;

  return useQuery(
    orpc.sharing.listGrants.queryOptions({
      input: { resourceType, id: resourceId },
      queryKey: collaboratorsQueryKey(userId, resourceType, resourceId),
      retry: shouldRetryQuery,
      // A known capability denial skips a request guaranteed to 403.
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
