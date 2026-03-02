import { tsr } from "@/lib/tsr";

/**
 * Hook to revoke a pending invitation.
 * Invalidates the experiment-invitations query on success so the list refreshes.
 */
export const useUserInvitationRevoke = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.revokeInvitation.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-invitations"] });
    },
  });
};
