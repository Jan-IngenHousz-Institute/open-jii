"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationTeamFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Deleting a team also deletes the grants naming it as a grantee — server-side, in
 * an after-delete hook — so the collaborator lists it appeared on are re-read.
 */
export const useDeleteOrganizationTeam = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { teamId: string }) =>
      unwrapAuthResult(
        await authClient.organization.removeTeam({ teamId: input.teamId, organizationId }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationTeamFamilies());
    },
  });
};
