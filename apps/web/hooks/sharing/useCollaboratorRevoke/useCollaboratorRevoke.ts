import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * Revoke a direct grant. Unlike the other sharing mutations this returns 204
 * (no body), so the row is dropped from the cache optimistically and the list is
 * refetched on settle. Cache reads and writes use the principal-scoped key.
 *
 * Revoking removes only this grant — the grantee may still reach the resource
 * through their organization role, another grant, or public visibility (doc
 * 008). That caveat is surfaced in the confirmation dialog, not here.
 *
 * **Self-revoke.** A direct admin may revoke their own grant, which can remove
 * the very access that is rendering the page they are on. Invalidating only the
 * collaborator list would leave a private resource sitting on screen with stale
 * data until the user happened to navigate. So when the revoked grantee is the
 * current user, the resource's own detail and list caches are dropped too — the
 * refetch then either succeeds (access survived via another precedence tier) or
 * fails as the route already knows how to handle. The decision stays server-side:
 * we re-ask rather than predict what access is left. Only *user* grantees can be
 * matched here; a self-affecting organization-grant revoke is invisible to the
 * client, and the list refetch remains the backstop.
 */
export const useCollaboratorRevoke = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation(
    orpc.sharing.revokeGrant.mutationOptions({
      onMutate: async (variables) => {
        const listKey = collaboratorsQueryKey(userId, variables.resourceType, variables.id);
        await queryClient.cancelQueries({ queryKey: listKey });

        const previousGrants = queryClient.getQueryData<ResourceGrantDto[]>(listKey);
        // Decided before the optimistic removal, while the row is still here.
        const revoked = previousGrants?.find((grant) => grant.id === variables.grantId);
        const revokedSelf =
          !!userId && revoked?.granteeType === "user" && revoked.granteeId === userId;

        if (previousGrants) {
          queryClient.setQueryData(
            listKey,
            previousGrants.filter((grant) => grant.id !== variables.grantId),
          );
        }

        return { previousGrants, revokedSelf };
      },
      onError: (_error, variables, context) => {
        if (context?.previousGrants) {
          queryClient.setQueryData(
            collaboratorsQueryKey(userId, variables.resourceType, variables.id),
            context.previousGrants,
          );
        }
      },
      onSuccess: async (_data, variables, context) => {
        if (!context.revokedSelf) return;
        // Only on success: a failed revoke changed nothing, so the page is still
        // backed by real access.
        await Promise.all(
          resourceCacheKeys(variables.resourceType, variables.id).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      },
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: collaboratorsQueryKey(userId, variables.resourceType, variables.id),
        });
      },
    }),
  );
};
