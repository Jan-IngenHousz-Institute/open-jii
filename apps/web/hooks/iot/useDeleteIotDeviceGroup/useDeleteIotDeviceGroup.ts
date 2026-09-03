import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteIotDeviceGroupProps {
  onSuccess?: () => void;
}

export const useDeleteIotDeviceGroup = (props: DeleteIotDeviceGroupProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.deleteIotDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroups.key() });
      },
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
