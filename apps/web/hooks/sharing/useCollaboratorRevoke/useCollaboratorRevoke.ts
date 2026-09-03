import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ResourceCollaboratorDto } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * Revoke returns no list, so the row is removed optimistically and restored on
 * failure. Self-revoke can remove the access rendering the current page; refresh
 * the resource caches so stale private content does not remain mounted. The server
 * then decides whether another access path survives instead of the client guessing.
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

        // Owner rows have no grant id, so narrow before matching.
        const previousGrants = queryClient.getQueryData<ResourceCollaboratorDto[]>(listKey);
        const revoked = previousGrants?.find(
          (row) => row.kind === "grant" && row.id === variables.grantId,
        );
        const revokedSelf =
          !!userId &&
          revoked?.kind === "grant" &&
          revoked.granteeType === "user" &&
          revoked.granteeId === userId;

        if (previousGrants) {
          queryClient.setQueryData(
            listKey,
            previousGrants.filter((row) => row.kind !== "grant" || row.id !== variables.grantId),
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
