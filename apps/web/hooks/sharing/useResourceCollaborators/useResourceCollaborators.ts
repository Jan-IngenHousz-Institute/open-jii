import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * Direct collaborators (grants) on a resource.
 *
 * The endpoint is gated on `can(share)`, not `read`, which makes it the
 * capability probe for the sharing surface as well as its data source: a caller
 * who may not share gets a 403 and the UI hides the surface entirely. 4xx are
 * not retried, so the 403 settles immediately instead of flickering.
 *
 * Two things keep that probe from ever answering for the wrong principal:
 * - the cache key carries the session user id (see `sharing-query-keys`), so a
 *   different user on the same browser starts from `pending`, not from the
 *   previous user's cached list;
 * - nothing is fetched until the session itself has resolved, so a request is
 *   never filed — and its result never cached — under a principal we don't know
 *   yet. Until then the query reports `pending` and callers fail closed.
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
      // Callers pass `enabled: false` when a capability signal already told them
      // the user cannot share, which skips a request that could only 403.
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
