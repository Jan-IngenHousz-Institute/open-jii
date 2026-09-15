import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface RetireIotDeviceProps {
  onSuccess?: () => void;
}

export const useRetireIotDevice = (props: RetireIotDeviceProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.retireIotDevice.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDevice.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroupMembers.key() });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentDevices.key(),
        });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
