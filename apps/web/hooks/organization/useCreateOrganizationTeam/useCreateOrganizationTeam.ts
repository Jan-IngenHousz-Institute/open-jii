"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationTeamFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Teams exist only inside a real organization — creation is refused for a personal
 * workspace, which is what makes every other team operation unreachable there.
 */
export const useCreateOrganizationTeam = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string }) =>
      unwrapAuthResult(
        await authClient.organization.createTeam({ organizationId, name: input.name }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationTeamFamilies());
    },
  });
};
