import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Revoke certificates for a group selection through the single-device
 * executor. Each revoked device stops authenticating immediately and stays
 * offline until new credentials are issued.
 */
export const useRevokeIotDeviceGroupCredentials = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.revokeIotDeviceGroupCredentials.mutationOptions({
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
