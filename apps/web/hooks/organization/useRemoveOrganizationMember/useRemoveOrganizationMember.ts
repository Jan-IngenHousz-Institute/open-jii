"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Removing a member drops their team memberships with them, but never their
 * direct grants: they become an outside collaborator on whatever they still hold.
 */
export const useRemoveOrganizationMember = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberIdOrEmail: string }) =>
      unwrapAuthResult(
        await authClient.organization.removeMember({
          organizationId,
          memberIdOrEmail: input.memberIdOrEmail,
        }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationMembershipFamilies());
    },
  });
};
