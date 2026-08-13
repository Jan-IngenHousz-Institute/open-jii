import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Onboard a device: bind it to experiments and receive the config to hand to
 * the hardware. An empty experiment list re-issues the config without binding.
 */
export const useOnboardDevice = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.onboardDevice.mutationOptions({
      onSettled: async (data, error, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.iot.listDeviceExperiments.queryKey({
              input: { deviceId: variables.deviceId },
            }),
          }),
          // The bound devices of every affected experiment changed too.
          ...(variables.experimentIds ?? []).map((experimentId) =>
            queryClient.invalidateQueries({
              queryKey: orpc.experiments.listExperimentDevices.queryKey({
                input: { id: experimentId },
              }),
            }),
          ),
        ]);
      },
    }),
  );
};
