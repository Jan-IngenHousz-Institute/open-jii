"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { organizationInvitationsQueryKey } from "@/hooks/organization/organization-cache";
import { useQuery } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/**
 * Pending invitations for the Invited tab. The one organization *read* that does
 * not go through a Nest endpoint: invitations are a Better Auth model with no
 * oRPC route, and their lifecycle (expiry, status) is the plugin's to report.
 *
 * Owner/admin only server-side, so a refusal is an answer and is not retried.
 */
export const useOrganizationInvitations = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: organizationInvitationsQueryKey(userId, organizationId),
    queryFn: async () =>
      unwrapAuthResult(
        await authClient.organization.listInvitations({ query: { organizationId } }),
      ),
    retry: false,
    enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
  });
};
