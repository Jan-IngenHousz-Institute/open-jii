import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to revoke a pending invitation.
 * Invalidates the invitations query on success so the list refreshes.
 */
export const useUserInvitationRevoke = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.revokeInvitation.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.users.listInvitations.key() });
      },
    }),
  );
};
