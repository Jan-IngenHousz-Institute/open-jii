import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { DeviceGroup } from "@repo/api/domains/device-group/device-group.schema";

interface CreateIotDeviceGroupProps {
  onSuccess?: (group: DeviceGroup) => void;
}

export const useCreateIotDeviceGroup = (props: CreateIotDeviceGroupProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.createDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
      },
      onSuccess: (group) => {
        props.onSuccess?.(group);
      },
    }),
  );
};
