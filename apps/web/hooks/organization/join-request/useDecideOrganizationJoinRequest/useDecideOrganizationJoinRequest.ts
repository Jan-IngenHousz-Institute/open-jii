import {
  invalidateFamilies,
  organizationMembershipFamilies,
} from "@/hooks/organization/organization-cache";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UseDecideOrganizationJoinRequestOptions = Pick<
  ReturnType<typeof orpc.organizations.decideOrganizationJoinRequest.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Approve or reject a request. Approval writes a membership row, so it moves
 * everything a membership moves — which is why it invalidates the shared membership
 * set rather than a hand-picked list: the roster and the member counts, but also the
 * Better Auth member-row map that supplies the row id a role write addresses, and
 * the collaborators lists where a new member can flip an existing direct grantee
 * from outside collaborator to internal.
 *
 * Without the member-row map, a member approved on an already-open screen appears on
 * the roster with no role control at all.
 */
export const useDecideOrganizationJoinRequest = (
  options?: UseDecideOrganizationJoinRequestOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.organizations.decideOrganizationJoinRequest.mutationOptions({
      ...options,
      onSettled: async (...args) => {
        await invalidateFamilies(queryClient, organizationMembershipFamilies());
        await options?.onSettled?.(...args);
      },
    }),
  );
};
