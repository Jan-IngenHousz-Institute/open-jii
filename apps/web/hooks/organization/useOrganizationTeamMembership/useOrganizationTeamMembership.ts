"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationTeamFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Add or remove a team member. One hook for both directions: the team detail page
 * offers them side by side, and either changes the same two things — the roster
 * and the head count a team grant admits on every resource shared with the team.
 *
 * Candidates come from the organization's own members; a non-member cannot be on
 * one of its teams, which is what keeps a team from ever being an outside
 * collaborator.
 */
export const useOrganizationTeamMembership = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    // Unwrapped per branch: the two calls resolve to different payloads, and a
    // union of envelopes is not an envelope of a union.
    mutationFn: async (input: { teamId: string; userId: string; action: "add" | "remove" }) => {
      const body = { teamId: input.teamId, userId: input.userId, organizationId };
      if (input.action === "add") {
        return unwrapAuthResult(await authClient.organization.addTeamMember(body));
      }
      return unwrapAuthResult(await authClient.organization.removeTeamMember(body));
    },
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationTeamFamilies());
    },
  });
};
