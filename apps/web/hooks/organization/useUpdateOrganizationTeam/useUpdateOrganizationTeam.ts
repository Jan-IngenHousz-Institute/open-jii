"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationTeamFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Rename a team. The name is what identifies it as a grantee, so grant rows move too.
 *
 * `organizationId` goes **inside `data`**, which is where this endpoint alone looks for
 * it: Better Auth resolves the target as `body.data.organizationId` and otherwise falls
 * back to the session's active organization. Nothing in this product ever sets one, so
 * omitting it does not pick a sensible default — it makes every rename fail.
 */
export const useUpdateOrganizationTeam = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { teamId: string; name: string }) =>
      unwrapAuthResult(
        await authClient.organization.updateTeam({
          teamId: input.teamId,
          data: { name: input.name, organizationId },
        }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationTeamFamilies());
    },
  });
};
