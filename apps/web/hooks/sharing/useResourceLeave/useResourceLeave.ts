import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Give up the caller's own direct grant (`DELETE …/collaborators/me`).
 *
 * This exists for grantees below `share` — typically "Can view" — who cannot see
 * the collaborators list and so have no row to self-revoke through
 * `useCollaboratorRevoke`. The server authorizes on the caller's own grant, not
 * `can(share)`.
 *
 * Leaving always removes the caller's own access-conferring row, so on success
 * the resource's own detail and list caches are dropped unconditionally (the
 * self-detection dance in `useCollaboratorRevoke` is unnecessary here — leave is
 * self-affecting by definition). The refetch then either succeeds (access
 * survived via another precedence tier) or fails as the route already handles.
 * The collaborators list cache is invalidated too for the edge case where the
 * caller was share-capable.
 */
export const useResourceLeave = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation(
    orpc.sharing.leaveResource.mutationOptions({
      onSuccess: async (_data, variables) => {
        await Promise.all(
          [
            ...resourceCacheKeys(variables.resourceType, variables.id),
            collaboratorsQueryKey(userId, variables.resourceType, variables.id),
          ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      },
    }),
  );
};
