import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Self-demotion can remove the capabilities rendering tabs and live controls.
 * Refresh the resource caches so those controls disappear instead of remaining
 * visible until another refetch; the server response identifies the changed row.
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

        // Use the server response; owner rows have no grant id.
        const retiered = data.find((row) => row.kind === "grant" && row.id === variables.grantId);
        const retieredSelf =
          !!userId &&
          retiered?.kind === "grant" &&
          retiered.granteeType === "user" &&
          retiered.granteeId === userId;
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
