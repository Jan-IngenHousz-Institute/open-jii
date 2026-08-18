import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BulkRegisterIotDevicesResult } from "@repo/api/domains/iot/iot.schema";

interface BulkRegisterIotDevicesProps {
  onSuccess?: (result: BulkRegisterIotDevicesResult) => void;
}

export const useBulkRegisterIotDevices = (props: BulkRegisterIotDevicesProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.bulkRegisterIotDevices.mutationOptions({
      // The batch touches the registry and, when grouped, every group surface.
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.getDeviceGroup.key() });
        await queryClient.invalidateQueries({
          queryKey: orpc.deviceGroups.listDeviceGroupMembers.key(),
        });
      },
      onSuccess: (result) => {
        props.onSuccess?.(result);
      },
    }),
  );
};
