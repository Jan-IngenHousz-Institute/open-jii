import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ReinstateIotDeviceProps {
  onSuccess?: () => void;
}

export const useReinstateIotDevice = (props: ReinstateIotDeviceProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.reinstateIotDevice.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDevice.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroupMembers.key() });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
