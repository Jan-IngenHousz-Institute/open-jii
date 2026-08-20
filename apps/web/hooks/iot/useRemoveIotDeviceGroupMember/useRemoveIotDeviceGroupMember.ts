import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useRemoveIotDeviceGroupMember = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.removeIotDeviceGroupMember.mutationOptions({
      // Membership touches the roster, the group's member count, and the list.
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.iot.listIotDeviceGroupMembers.key(),
        });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.getIotDeviceGroup.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.iot.listIotDeviceGroups.key() });
      },
    }),
  );
};
