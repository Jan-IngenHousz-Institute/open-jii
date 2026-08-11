import {
  invalidateFamilies,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UseAddOrganizationMemberOptions = Pick<
  ReturnType<typeof orpc.organizations.addOrganizationMember.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Admit somebody who already has an account. Unlike an invitation this lands a
 * membership immediately, so it moves everything a membership moves — the roster and
 * the member counts, the Better Auth member-row map that supplies the row id a role
 * write addresses, and the collaborators lists where a new member flips an existing
 * direct grantee from outside collaborator to internal.
 *
 * The invitations list is deliberately not in that set: an address with a live
 * invitation is not offered for adding in the first place, so this write never
 * leaves one behind.
 */
export const useAddOrganizationMember = (options?: UseAddOrganizationMemberOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.organizations.addOrganizationMember.mutationOptions({
      ...options,
      onSettled: async (...args) => {
        await invalidateFamilies(queryClient, organizationMembershipFamilies());
        await options?.onSettled?.(...args);
      },
    }),
  );
};
