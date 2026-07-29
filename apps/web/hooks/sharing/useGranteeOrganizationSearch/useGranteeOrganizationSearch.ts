import { granteeOrganizationsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Organizations the current user may pick as a grantee in the collaborators
 * picker. The endpoint is read-scoped to the caller's own memberships, so the
 * result set is small and safe to fetch as soon as the picker opens — unlike
 * user search, an empty query is meaningful here (it lists all of them).
 *
 * Because the result set *is* the caller's memberships, the cache key carries the
 * session user id and nothing is fetched before the session resolves — same
 * reasoning as `useResourceCollaborators`.
 */
export const useGranteeOrganizationSearch = (
  queryString: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const query = queryString.trim() || undefined;

  return useQuery(
    orpc.sharing.searchGranteeOrganizations.queryOptions({
      input: { query },
      queryKey: granteeOrganizationsQueryKey(userId, query),
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
