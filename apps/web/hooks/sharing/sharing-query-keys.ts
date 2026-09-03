import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * These keys need explicit principal scoping because oRPC-generated keys cannot
 * nest under the `["auth", …]` namespace that `useSignOut` invalidates.
 */

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

/** Cache key for a resource's grantee-user search, scoped to the asking principal. */
export function granteeUsersQueryKey(
  userId: string | undefined,
  resourceType: SharingResourceType,
  resourceId: string,
  query: string | undefined,
) {
  const input = { resourceType, id: resourceId, query };
  return orpc.sharing.searchGranteeUsers.queryKey({
    input,
    queryKey: withPrincipal(orpc.sharing.searchGranteeUsers.queryKey({ input }), userId),
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
