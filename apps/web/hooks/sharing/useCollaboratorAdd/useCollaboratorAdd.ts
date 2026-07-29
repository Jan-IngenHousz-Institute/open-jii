import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Share a resource with a user or organization (upsert — re-sharing an existing
 * grantee updates their role). The endpoint returns the full updated
 * collaborators list, so the cache is seeded from the response and no follow-up
 * fetch is needed; the list is still invalidated on settle to converge with any
 * concurrent change.
 *
 * Cache writes go to the principal-scoped key, so they land on the entry the
 * signed-in user's own query reads.
 */
export const useCollaboratorAdd = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation(
    orpc.sharing.createGrant.mutationOptions({
      onSuccess: (data, variables) => {
        queryClient.setQueryData(
          collaboratorsQueryKey(userId, variables.resourceType, variables.id),
          data,
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
