import { tsr } from "@/lib/tsr";

interface UseExperimentDeviceRemoveProps {
  onSuccess?: () => void;
}

/**
 * Detach a device from an experiment.
 */
export const useExperimentDeviceRemove = (props: UseExperimentDeviceRemoveProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.removeExperimentDevice.useMutation({
    onSettled: async (data, error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["experiment-devices", variables.params.id] }),
        // The detached device's own bound-experiments list changed too.
        queryClient.invalidateQueries({
          queryKey: ["device-experiments", variables.params.deviceId],
        }),
      ]);
    },
    onSuccess: () => {
      props.onSuccess?.();
    },
  });
};
