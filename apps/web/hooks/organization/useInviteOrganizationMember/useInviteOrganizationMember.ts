"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { organizationInvitationsQueryKey } from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { authClient, useSession } from "@repo/auth/client";

/**
 * Better Auth sends the invitation email and owns the 48-hour expiry. Only the
 * Invited tab moves: an invitation is not a membership until it is accepted.
 */
export const useInviteOrganizationMember = (organizationId: string) => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: { email: string; role: OrganizationRole }) =>
      unwrapAuthResult(
        await authClient.organization.inviteMember({
          organizationId,
          email: input.email,
          role: input.role,
        }),
      ),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: organizationInvitationsQueryKey(userId, organizationId),
      });
    },
  });
};
