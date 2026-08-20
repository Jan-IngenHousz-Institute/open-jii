"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationProfileFamilies,
} from "@/hooks/organization/organization-cache";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  OrganizationType,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";
import { authClient } from "@repo/auth/client";

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  type?: OrganizationType | null;
  description?: string | null;
  website?: string | null;
  location?: string | null;
  visibility?: OrganizationVisibility;
}

/** The `data` payload Better Auth's update endpoint declares. */
type AuthUpdateOrganizationData = Parameters<typeof authClient.organization.update>[0]["data"];

/**
 * Settings and the directory toggle are the same Better Auth write. `visibility`
 * only reaches the database because it is registered as an organization
 * additional field: the plugin builds its update body from that list and drops
 * every key not on it, so an unregistered field would 200 and change nothing.
 */
export const useUpdateOrganization = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) =>
      unwrapAuthResult(
        await authClient.organization.update({
          organizationId,
          // Sent verbatim, nulls included: clearing a profile field is a real
          // edit, and only keys the caller passed are in the object at all.
          //
          // The assertion covers a gap in Better Auth's own types, not in ours:
          // it builds the body schema for additional fields with `.nullish()`, so
          // null is accepted at runtime, while the type it infers for them narrows
          // to `string | undefined`. Sending `""` instead would store a
          // set-but-blank profile field — and would fail outright for `type`,
          // which is a database enum with no empty member.
          data: input as AuthUpdateOrganizationData,
        }),
      ),
    onSettled: async () => {
      await invalidateFamilies(queryClient, [
        ...organizationProfileFamilies(),
        // An organization is a grantee too, and its name is what a collaborator row
        // shows for one — so a rename has to reach the collaborators lists.
        orpc.sharing.listGrants.key(),
      ]);
    },
  });
};
