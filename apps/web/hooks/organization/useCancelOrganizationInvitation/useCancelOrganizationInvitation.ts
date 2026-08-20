"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { organizationInvitationsQueryKey } from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/** Withdraw a pending invitation. Re-inviting is a cancel followed by a new invite. */
export const useCancelOrganizationInvitation = (organizationId: string) => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: { invitationId: string }) =>
      unwrapAuthResult(
        await authClient.organization.cancelInvitation({ invitationId: input.invitationId }),
      ),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: organizationInvitationsQueryKey(userId, organizationId),
      });
    },
  });
};
