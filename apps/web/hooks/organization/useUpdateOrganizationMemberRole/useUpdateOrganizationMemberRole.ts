"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { authClient } from "@repo/auth/client";

/**
 * Better Auth enforces who may hand out which role — admins cannot touch owners,
 * and only owners grant the owner role — plus the last-owner floor. The roster UI
 * mirrors those rules so the affordance is absent rather than merely refused, but
 * a raced refusal still surfaces its own message.
 */
export const useUpdateOrganizationMemberRole = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberId: string; role: OrganizationRole }) =>
      unwrapAuthResult(
        await authClient.organization.updateMemberRole({
          organizationId,
          memberId: input.memberId,
          role: input.role,
        }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationMembershipFamilies());
    },
  });
};
