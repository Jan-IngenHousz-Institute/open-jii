import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteIotDeviceGroupProps {
  onSuccess?: () => void;
}

export const useDeleteIotDeviceGroup = (props: DeleteIotDeviceGroupProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.deleteDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
