import { tsr } from "@/lib/tsr";

interface CreateUserProfileProps {
  onSuccess?: () => void;
}

export const useCreateUserProfile = (props: CreateUserProfileProps) => {
  return tsr.users.createUserProfile.useMutation({
    onSuccess: () => {
      if (props.onSuccess) props.onSuccess();
    },
  });
};
