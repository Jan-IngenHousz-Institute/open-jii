import { ANONYMOUS_PRINCIPAL, withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ResourceScope } from "@repo/api/shared/listing";
import { useSession } from "@repo/auth/client";

/**
 * The organization directory: public organizations plus the caller's own private
 * ones. Both the row set and each row's membership status depend on the caller, so
 * the cache is principal-scoped — a module-level QueryClient survives sign-out, and
 * the next user must not inherit the previous one's directory or join state.
 *
 * `scope: "related"` is the "my organizations" slice. It is the same endpoint with one
 * more condition, so both slices search the same fields and rank the same way.
 *
 * Unpaged: the endpoint returns every match.
 */
export const useOrganizations = (
  params: { search?: string; scope?: ResourceScope } = {},
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const principal = userId ?? ANONYMOUS_PRINCIPAL;
  const search = params.search?.trim();
  const input = {
    // An empty box is "no filter", not a search for the empty string.
    search: search === "" ? undefined : search,
    scope: params.scope,
  };

  return useQuery(
    orpc.organizations.listOrganizations.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.listOrganizations.queryKey({ input }), userId),
      meta: { scope: input.scope, principal },
      // A new search term is a new cache key, and without this the list would fall
      // back to its pending state — unmounting every row, including a join dialog the
      // reader had open. The rows stay put while the next result set loads; the search
      // input's own spinner is what says it is still moving.
      //
      // Held only within one scope. A term narrows the set it is already showing, but
      // "mine" and "all" are different sets: carrying rows across would render public
      // organizations the reader does not belong to under "My organizations", counts
      // and all, until the refetch lands.
      placeholderData: (previous, previousQuery) =>
        previousQuery?.meta?.scope === input.scope && previousQuery?.meta?.principal === principal
          ? previous
          : undefined,
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
