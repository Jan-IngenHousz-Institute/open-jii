import { tsr } from "@/lib/tsr";

import type { IotDevice } from "@repo/api/schemas/iot.schema";

interface RegisterIotDeviceProps {
  onSuccess?: (device: IotDevice) => void;
}

export const useRegisterIotDevice = (props: RegisterIotDeviceProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.registerIotDevice.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onSuccess: (data) => {
      props.onSuccess?.(data.body);
    },
  });
};
