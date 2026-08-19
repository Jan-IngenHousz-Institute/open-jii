"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  myOrganizationInvitationsQueryKey,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/**
 * Accept or decline: one hook, because both are the same transition from the
 * page's point of view and both retire the invitation. Accepting creates the
 * membership, so my-organizations and the organization's own reads move with it.
 */
export const useRespondToOrganizationInvitation = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    // Unwrapped per branch: accepting answers with the new membership, declining
    // with the retired invitation, so a union of envelopes is not an envelope of
    // a union.
    mutationFn: async (input: { invitationId: string; decision: "accept" | "reject" }) => {
      const body = { invitationId: input.invitationId };
      if (input.decision === "accept") {
        return unwrapAuthResult(await authClient.organization.acceptInvitation(body));
      }
      return unwrapAuthResult(await authClient.organization.rejectInvitation(body));
    },
    onSettled: async () => {
      // The answered invitation leaves the recipient's own list, which is what the
      // header bell and the account tab both render.
      await queryClient.invalidateQueries({
        queryKey: myOrganizationInvitationsQueryKey(userId),
      });
      await invalidateFamilies(queryClient, organizationMembershipFamilies());
    },
  });
};
