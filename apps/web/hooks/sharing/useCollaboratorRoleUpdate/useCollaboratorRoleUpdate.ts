import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * Change the role on an existing direct grant. Like `createGrant`, the endpoint
 * responds with the full updated collaborators list, which seeds the cache — on
 * the principal-scoped key the signed-in user's own query reads.
 */
export const useCollaboratorRoleUpdate = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation(
    orpc.sharing.updateGrant.mutationOptions({
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
