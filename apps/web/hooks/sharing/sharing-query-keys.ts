import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * Principal-scoped cache keys for the authorization-sensitive sharing queries.
 *
 * Both `listGrants` and `searchGranteeOrganizations` return data whose contents
 * depend entirely on *who is asking* — the collaborators list is `can(share)`-
 * gated, and organization search is scoped to the caller's own memberships. See
 * `principal-query-key` for why that needs its own cache entry per principal and
 * what else a caller has to do to make the scoping hold.
 *
 * The other principal-sensitive hooks in the app (`usePasskeys`, `useApiKeys`)
 * get the same protection by living under the `["auth", …]` namespace that
 * `useSignOut` invalidates; oRPC-generated keys cannot nest there, hence this
 * module.
 */

export { ANONYMOUS_PRINCIPAL } from "@/hooks/principal-query-key";

/** Cache key for a resource's collaborators, scoped to the asking principal. */
export function collaboratorsQueryKey(
  userId: string | undefined,
  resourceType: SharingResourceType,
  resourceId: string,
) {
  const input = { resourceType, id: resourceId };
  return orpc.sharing.listGrants.queryKey({
    input,
    queryKey: withPrincipal(orpc.sharing.listGrants.queryKey({ input }), userId),
  });
}

/** Cache key for the grantee-organization search, scoped to the asking principal. */
export function granteeOrganizationsQueryKey(
  userId: string | undefined,
  query: string | undefined,
) {
  const input = { query };
  return orpc.sharing.searchGranteeOrganizations.queryKey({
    input,
    queryKey: withPrincipal(orpc.sharing.searchGranteeOrganizations.queryKey({ input }), userId),
  });
}
