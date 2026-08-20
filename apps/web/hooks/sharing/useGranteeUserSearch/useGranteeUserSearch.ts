import { granteeUsersQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * The picker's user source: everyone the global search would find, annotated with
 * the access they already hold on this resource. Share-gated, so a denial is not
 * retried, and the cache is principal-scoped like the collaborators list beside it.
 *
 * Needs a term — the user directory is not browsable, unlike teams and organizations.
 */
export const useGranteeUserSearch = (
  resourceType: SharingResourceType,
  resourceId: string,
  queryString: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const query = queryString.trim() || undefined;
  const input = { resourceType, id: resourceId, query };

  return useQuery(
    orpc.sharing.searchGranteeUsers.queryOptions({
      input,
      queryKey: granteeUsersQueryKey(userId, resourceType, resourceId, query),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!query && !!resourceId && !isSessionPending,
    }),
  );
};
