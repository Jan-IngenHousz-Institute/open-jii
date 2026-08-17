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
        // Deleting a device cascades its experiment bindings away.
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentDevices.key(),
        });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceExperiments.key() });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
