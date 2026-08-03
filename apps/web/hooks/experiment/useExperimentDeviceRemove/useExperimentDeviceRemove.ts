import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UseExperimentDeviceRemoveProps {
  onSuccess?: () => void;
}

/**
 * Detach a device from an experiment.
 */
export const useExperimentDeviceRemove = (props: UseExperimentDeviceRemoveProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.removeExperimentDevice.mutationOptions({
      onSettled: async (data, error, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.listExperimentDevices.queryKey({
              input: { id: variables.id },
            }),
          }),
          // The detached device's own bound-experiments list changed too.
          queryClient.invalidateQueries({
            queryKey: orpc.iot.listDeviceExperiments.queryKey({
              input: { deviceId: variables.deviceId },
            }),
          }),
        ]);
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
