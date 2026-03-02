import { tsr } from "@/lib/tsr";

/**
 * Hook to update the role on a pending invitation.
 * Invalidates the experiment-invitations query on success so the list refreshes.
 */
export const useUserInvitationRoleUpdate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.updateInvitationRole.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-invitations"] });
    },
  });
};
