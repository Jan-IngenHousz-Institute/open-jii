import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { IotDeviceGroup } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

interface CreateIotDeviceGroupProps {
  onSuccess?: (group: IotDeviceGroup) => void;
}

export const useCreateIotDeviceGroup = (props: CreateIotDeviceGroupProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.createIotDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroups.key() });
      },
      onSuccess: (group) => {
        props.onSuccess?.(group);
      },
    }),
  );
};
