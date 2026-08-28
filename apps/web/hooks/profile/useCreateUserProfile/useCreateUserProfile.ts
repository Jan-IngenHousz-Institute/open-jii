import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreateUserProfileProps {
  onSuccess?: () => Promise<void> | void;
}

export const useCreateUserProfile = (props: CreateUserProfileProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.createUserProfile.mutationOptions({
      onSuccess: async () => {
        if (props.onSuccess) await props.onSuccess();
      },
      onSettled: async () => {
        // A profile name is also part of organization global search for fellow members.
        await queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
