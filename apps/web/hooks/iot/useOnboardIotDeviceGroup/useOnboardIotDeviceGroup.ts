import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Onboard a group: bind the selected members to experiments through the
 * single-device executor and receive one config per device. An empty
 * experiment list re-issues every selected device's config.
 */
export const useOnboardIotDeviceGroup = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.onboardIotDeviceGroup.mutationOptions({
      onSettled: async (data, error, variables) => {
        await Promise.all([
          // Bindings changed for an unknown subset of devices: invalidate the family.
          queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceExperiments.key() }),
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
