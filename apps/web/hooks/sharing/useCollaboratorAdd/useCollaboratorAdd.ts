import { collaboratorsQueryKey } from "@/hooks/sharing/sharing-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/** Shares a resource and seeds the caller's collaborator cache from the response. */
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
