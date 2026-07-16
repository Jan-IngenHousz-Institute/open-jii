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
        // Ensure any component reading the user profile refetches and gets the latest data
        await queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });
      },
    }),
  );
};
