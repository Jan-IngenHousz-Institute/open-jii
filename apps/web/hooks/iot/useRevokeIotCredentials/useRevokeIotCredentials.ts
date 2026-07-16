import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface RevokeIotCredentialsProps {
  onSuccess?: () => void;
}

export const useRevokeIotCredentials = (props: RevokeIotCredentialsProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.revokeIotCredentials.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDevice.key() });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
