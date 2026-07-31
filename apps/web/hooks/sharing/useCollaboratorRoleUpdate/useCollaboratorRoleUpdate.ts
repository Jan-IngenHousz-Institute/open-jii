import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Change the role on an existing direct grant. Like `createGrant`, the endpoint
 * responds with the full updated collaborators list, which seeds the cache — on
 * the principal-scoped key the signed-in user's own query reads.
 *
 * **Self-demotion.** A direct admin may retier their own grant, which can take
 * away the very capabilities the management UI is rendered from — "Can edit" to
 * "Can view" drops `share` and `manage`. Updating only the collaborators list
 * would leave the tabs, the invite action and the row controls on screen, live and
 * about to 403, until something else happened to refetch. So when the retiered
 * grant is the current user's, the resource's own caches are dropped too and the
 * capabilities re-resolve from the server. As with revoke, only *user* grantees
 * can be matched here; an organization grant that happens to cover the caller is
 * invisible to the client.
 */
export const useCollaboratorRoleUpdate = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation(
    orpc.sharing.updateGrant.mutationOptions({
      onSuccess: async (data, variables) => {
        queryClient.setQueryData(
          collaboratorsQueryKey(userId, variables.resourceType, variables.id),
          data,
        );

        // Read off the response rather than the cache: it is the server's own
        // record of the row that just changed. Owner rows carry no id, hence the
        // `kind` narrowing.
        const retiered = data.find((row) => row.kind === "grant" && row.id === variables.grantId);
        const retieredSelf =
          !!userId && retiered?.granteeType === "user" && retiered.granteeId === userId;
        if (!retieredSelf) return;

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
