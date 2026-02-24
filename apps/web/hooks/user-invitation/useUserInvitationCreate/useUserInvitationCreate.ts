import { tsr } from "@/lib/tsr";

/**
 * Hook to create invitations (invite users by email to a resource).
 * Invalidates the experiment-invitations query on success so the list refreshes.
 */
export const useUserInvitationCreate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.createInvitations.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-invitations"] });
    },
  });
};
