import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Grantees below `share` cannot see a row to self-revoke, so this uses the
 * caller-own-grant endpoint. Leaving can remove the access rendering the page;
 * refresh detail/list caches so stale private content does not stay mounted, and
 * refresh collaborators for the share-capable edge case.
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
