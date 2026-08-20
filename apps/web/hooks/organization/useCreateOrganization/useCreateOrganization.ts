"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import {
  invalidateFamilies,
  organizationProfileFamilies,
} from "@/hooks/organization/organization-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  OrganizationType,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";
import { authClient } from "@repo/auth/client";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  type?: OrganizationType;
  description?: string;
  website?: string;
  location?: string;
  visibility: OrganizationVisibility;
}

/**
 * Creating an organization is a Better Auth write: the plugin owns the row, the
 * creator's owner membership and the slug uniqueness check.
 *
 * `keepCurrentActiveOrganization` is a field of the request body in Better Auth
 * 1.6.23, not a plugin option, so it has to be passed on every call. Without it
 * the plugin points the session's active organization at the new row — a piece of
 * state this product has no concept of and no surface for, which would then
 * silently steer every Better Auth call that defaults to "the active
 * organization" for the rest of the session.
 */
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrganizationInput) => {
      const organization = unwrapAuthResult(
        await authClient.organization.create({
          name: input.name,
          slug: input.slug,
          keepCurrentActiveOrganization: true,
          // Always sent, unlike the fields below: absent would be the server's default.
          visibility: input.visibility,
          // Empty optional fields are omitted rather than sent as "": the column
          // is nullable and an empty string would render as a set-but-blank value.
          ...(input.type ? { type: input.type } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.website ? { website: input.website } : {}),
          ...(input.location ? { location: input.location } : {}),
        }),
      );
      return organization;
    },
    onSettled: async () => {
      await invalidateFamilies(queryClient, organizationProfileFamilies());
    },
  });
};
