"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { organizationInvitationQueryKey } from "@/hooks/organization/organization-cache";
import { useQuery } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/**
 * The invitation an accept-invitation link names. Better Auth answers this one
 * itself: it decides whether the invitation is still live, and refuses when the
 * signed-in account is not the addressee — so a refusal is the page's answer and
 * must not be retried.
 *
 * Runs only for a signed-in caller: the route requires a session, and a
 * signed-out visitor is sent to sign in first.
 */
export const useOrganizationInvitation = (
  invitationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: organizationInvitationQueryKey(userId, invitationId),
    queryFn: async () =>
      unwrapAuthResult(
        await authClient.organization.getInvitation({ query: { id: invitationId } }),
      ),
    retry: false,
    enabled: (options?.enabled ?? true) && !!invitationId && !isSessionPending && !!userId,
  });
};
