"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Leaving is refused for the last owner, and for a personal workspace at all —
 * both server-side, in Better Auth and in a hand-rolled Nest shield respectively,
 * because the leave route fires none of the plugin's organization hooks.
 */
export const useLeaveOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { organizationId: string }) =>
      unwrapAuthResult(
        await authClient.organization.leave({ organizationId: input.organizationId }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationMembershipFamilies());
    },
  });
};
