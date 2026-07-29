import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { shouldRetryQuery } from "~/util/query-retry";

import type { InvitationResourceType } from "@repo/api/domains/user/user.schema";
import { useSession } from "@repo/auth/client";

/** Cache key for a resource's pending invitations, scoped to the asking principal. */
export function invitationsQueryKey(
  userId: string | undefined,
  resourceType: InvitationResourceType,
  resourceId: string,
) {
  const input = { resourceType, resourceId };
  return orpc.users.listInvitations.queryKey({
    input,
    queryKey: withPrincipal(orpc.users.listInvitations.queryKey({ input }), userId),
  });
}

/**
 * Hook to fetch pending invitations for a resource.
 *
 * The endpoint is gated on `can(share)`, not `read` — a pending invitation exposes
 * the invitee's email address and the access they were offered, so it sits behind
 * the capability that manages collaborators. Callers that already hold a capability
 * signal pass `enabled: false` to skip a request that could only 403; 4xx are not
 * retried either way, so a denial settles immediately instead of flickering.
 *
 * Because the answer is one principal's view of who was invited, the cache entry
 * carries the principal and nothing is fetched until the session resolves — see
 * `principal-query-key`.
 *
 * @param resourceType The type of resource (e.g. "experiment")
 * @param resourceId The ID of the resource
 */
export const useUserInvitations = (
  resourceType: InvitationResourceType,
  resourceId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery(
    orpc.users.listInvitations.queryOptions({
      input: {
        resourceType,
        resourceId,
      },
      queryKey: invitationsQueryKey(session?.user.id, resourceType, resourceId),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
