import { tsr } from "@/lib/tsr";

/**
 * Onboard a device: bind it to experiments and receive the config to hand to
 * the hardware. An empty experiment list re-issues the config without binding.
 */
export const useOnboardDevice = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.onboardDevice.useMutation({
    onSettled: async (data, error, variables) => {
      const experimentIds = variables.body?.experimentIds ?? [];
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["device-experiments", variables.params.deviceId],
        }),
        // The bound devices of every affected experiment changed too.
        ...experimentIds.map((experimentId) =>
          queryClient.invalidateQueries({ queryKey: ["experiment-devices", experimentId] }),
        ),
      ]);
    },
  });
};
