import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useAddIotDeviceGroupMembers = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.addDeviceGroupMembers.mutationOptions({
      // Membership touches the roster, the group's member count, and the list.
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.deviceGroups.listDeviceGroupMembers.key(),
        });
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.getDeviceGroup.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
      },
    }),
  );
};
