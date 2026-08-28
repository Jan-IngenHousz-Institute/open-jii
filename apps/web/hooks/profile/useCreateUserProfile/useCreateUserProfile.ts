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
        // The caller's profile name is searchable inside organizations they belong to.
        await queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
