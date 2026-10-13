import { usePrincipal } from "@/components/auth/principal-context";
import { ANONYMOUS_PRINCIPAL } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { OrganizationSort } from "@repo/api/domains/organization/organization.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { organizationsListQuery } from "./organizations-list-query";

/**
 * The organization directory: public organizations plus the caller's own private
 * ones. Both the row set and each row's membership status depend on the caller, so
 * the cache is principal-scoped — a module-level QueryClient survives sign-out, and
 * the next user must not inherit the previous one's directory or join state.
 *
 * Unpaged: the endpoint returns every match.
 */
export const useOrganizations = (
  params: { search?: string; scope?: ResourceScope; sort?: OrganizationSort } = {},
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const principal = userId ?? ANONYMOUS_PRINCIPAL;
  return useQuery({
    ...organizationsListQuery(orpc, userId, params),
    meta: { scope: params.scope, principal },
    // A new search term is a new cache key, and without this the list would fall
    // back to its pending state — unmounting every row, including a join dialog the
    // reader had open. The rows stay put while the next result set loads; the search
    // input's own spinner is what says it is still moving.
    //
    // Held only within one scope so callers with a narrower resource listing never
    // inherit rows from the full directory while their request is in flight.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.meta?.scope === params.scope && previousQuery?.meta?.principal === principal
        ? previous
        : undefined,
    enabled: (options?.enabled ?? true) && !isSessionPending,
  });
};
