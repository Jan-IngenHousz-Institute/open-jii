import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { IotDevice } from "@repo/api/domains/iot/iot.schema";

interface RegisterIotDeviceProps {
  onSuccess?: (device: IotDevice) => void;
}

export const useRegisterIotDevice = (props: RegisterIotDeviceProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.registerIotDevice.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDevices.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
