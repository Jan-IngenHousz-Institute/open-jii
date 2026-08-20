import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Rotate certificates for a group selection through the single-device
 * executor. Each device's old certificate stops working the moment its row
 * succeeds; the response is the only time the new private keys are readable.
 */
export const useRotateIotDeviceGroupCredentials = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.rotateIotDeviceGroupCredentials.mutationOptions({
      onSettled: async () => {
        // Credential state changed for an unknown subset of devices: refresh the
        // roster and every device surface that renders it.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroupMembers.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDevice.key() }),
        ]);
      },
    }),
  );
};
