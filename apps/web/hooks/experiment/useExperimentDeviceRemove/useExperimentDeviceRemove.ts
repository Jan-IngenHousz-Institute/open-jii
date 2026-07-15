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
      await queryClient.invalidateQueries({
        queryKey: ["experiment-devices", variables.params.id],
      });
    },
    onSuccess: () => {
      props.onSuccess?.();
    },
  });
};
