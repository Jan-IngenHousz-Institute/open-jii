import { tsr } from "@/lib/tsr";

interface CreateUserProfileProps {
  onSuccess?: () => Promise<void> | void;
}

export const useCreateUserProfile = (props: CreateUserProfileProps) => {
  return tsr.users.createUserProfile.useMutation({
    onSuccess: async () => {
      if (props.onSuccess) await props.onSuccess();
    },
  });
};
