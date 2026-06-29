import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/**
 * Hook to create an invitation (invite a user by email to a resource).
 * Invalidates the invitations query on success so the list refreshes.
 */
export const useUserInvitationCreate = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.createInvitation.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.users.listInvitations.key() });
      },
    }),
  );
};
