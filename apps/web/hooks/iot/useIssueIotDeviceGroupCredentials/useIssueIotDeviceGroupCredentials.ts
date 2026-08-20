import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Issue certificates for a group selection through the single-device executor,
 * one certificate per device. The response is the only time the private keys
 * are readable.
 */
export const useIssueIotDeviceGroupCredentials = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.issueIotDeviceGroupCredentials.mutationOptions({
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
