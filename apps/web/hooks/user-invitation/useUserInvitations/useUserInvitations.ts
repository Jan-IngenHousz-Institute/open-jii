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
 * Invitations expose email addresses and tiers, so the endpoint is share-gated
 * and 4xx responses are not retried. Principal-scoped keys plus the session wait
 * prevent another user from receiving cached invitee data.
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
      // A known capability denial skips a request guaranteed to 403.
      enabled: (options?.enabled ?? true) && !isSessionPending,
    }),
  );
};
