import { granteeOrganizationsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/** Searches the caller's organizations, with a principal-scoped cache. */
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
