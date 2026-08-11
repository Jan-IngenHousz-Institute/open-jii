import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * The organization directory. Every row carries the caller's own membership
 * status, so the cache is principal-scoped: a module-level QueryClient survives
 * sign-out, and the next user must not inherit the previous one's join state.
 */
export const useOrganizations = (
  params: { search?: string; limit?: number; offset?: number } = {},
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const search = params.search?.trim();
  const input = {
    // An empty box is "no filter", not a search for the empty string.
    search: search === "" ? undefined : search,
    limit: params.limit,
    offset: params.offset,
  };

  return useQuery(
    orpc.organizations.listOrganizations.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.listOrganizations.queryKey({ input }), userId),
      // A new search term is a new cache key, and without this the list would fall
      // back to its pending state — unmounting every row, including a join dialog the
      // reader had open. The rows stay put while the next page loads; the search
      // input's own spinner is what says it is still moving.
      placeholderData: keepPreviousData,
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
