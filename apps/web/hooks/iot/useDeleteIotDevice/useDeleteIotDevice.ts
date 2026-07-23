import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteIotDeviceProps {
  onSuccess?: () => void;
}

export const useDeleteIotDevice = (props: DeleteIotDeviceProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.deleteIotDevice.mutationOptions({
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
