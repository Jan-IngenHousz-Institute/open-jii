import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/**
 * Hook to update the role on a pending invitation.
 * Invalidates the invitations query on success so the list refreshes.
 */
export const useUserInvitationRoleUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.updateInvitationRole.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.users.listInvitations.key() });
      },
    }),
  );
};
