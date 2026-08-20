"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationAuthFamilies,
  organizationProfileFamilies,
} from "@/hooks/organization/organization-cache";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Deleting an organization is refused server-side while it still owns any
 * resource, and for personal workspaces always. Nothing cascades, so the refusal
 * message ("still owns N resources") is the actionable part and is surfaced as-is.
 */
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { organizationId: string }) =>
      unwrapAuthResult(
        await authClient.organization.delete({ organizationId: input.organizationId }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, [
        ...organizationProfileFamilies(),
        // Deleting the organization tears down the grants it and its teams held, so
        // already-cached collaborator lists would otherwise keep showing grantees
        // that no longer exist.
        orpc.sharing.listGrants.key(),
        orpc.organizations.listGranteeTeams.key(),
        orpc.organizations.listOrganizationTeams.key(),
        orpc.organizations.getOrganizationDeletionBlockers.key(),
        // Every Better Auth read of an organization that is now gone.
        ...organizationAuthFamilies(),
      ]);
    },
  });
};
