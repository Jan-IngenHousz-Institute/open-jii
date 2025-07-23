import { tsr } from "@/lib/tsr";

interface SetUserRegisteredProps {
  onSuccess?: () => void;
}

export const useSetUserRegistered = (props: SetUserRegisteredProps) => {
  return tsr.users.setUserRegistered.useMutation({
    onSuccess: () => {
      if (props.onSuccess) props.onSuccess();
    },
  });
};
