import { tsr } from "@/lib/tsr";

import type { DeviceOnboardingConfig } from "@repo/api/schemas/iot.schema";

interface UseOnboardDeviceProps {
  onSuccess?: (config: DeviceOnboardingConfig) => void;
}

/**
 * Onboard a device: bind it to experiments and receive the config to hand to
 * the hardware. An empty experiment list re-issues the config without binding.
 */
export const useOnboardDevice = (props: UseOnboardDeviceProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.onboardDevice.useMutation({
    onSettled: async (data, error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["device-experiments", variables.params.deviceId],
      });
    },
    onSuccess: (data) => {
      props.onSuccess?.(data.body);
    },
  });
};
