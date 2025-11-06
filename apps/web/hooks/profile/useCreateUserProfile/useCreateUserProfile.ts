import { tsr } from "@/lib/tsr";

interface CreateUserProfileProps {
  onSuccess?: () => Promise<void> | void;
}

export const useCreateUserProfile = (props: CreateUserProfileProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.users.createUserProfile.useMutation({
    onSuccess: async () => {
      if (props.onSuccess) await props.onSuccess();
    },
    onSettled: async () => {
      // Ensure any component reading the user profile refetches and gets the latest data
      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });
};
