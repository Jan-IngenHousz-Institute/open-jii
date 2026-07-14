import { tsr } from "@/lib/tsr";

interface RevokeIotCredentialsProps {
  onSuccess?: () => void;
}

export const useRevokeIotCredentials = (props: RevokeIotCredentialsProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.revokeIotCredentials.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onSuccess: () => {
      props.onSuccess?.();
    },
  });
};
