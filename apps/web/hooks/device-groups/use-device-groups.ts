import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DeviceGroup } from "@repo/api/domains/device-group/device-group.schema";

export const useDeviceGroups = () => {
  return useQuery(orpc.deviceGroups.listDeviceGroups.queryOptions());
};

export const useDeviceGroup = (groupId: string) => {
  return useQuery(orpc.deviceGroups.getDeviceGroup.queryOptions({ input: { groupId } }));
};

export const useDeviceGroupMembers = (groupId: string) => {
  return useQuery(orpc.deviceGroups.listDeviceGroupMembers.queryOptions({ input: { groupId } }));
};

interface CreateDeviceGroupProps {
  onSuccess?: (group: DeviceGroup) => void;
}

export const useCreateDeviceGroup = (props: CreateDeviceGroupProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.createDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
      },
      onSuccess: (group) => {
        props.onSuccess?.(group);
      },
    }),
  );
};

export const useUpdateDeviceGroup = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.updateDeviceGroup.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.getDeviceGroup.key() });
      },
    }),
  );
};

interface DeleteDeviceGroupProps {
  onSuccess?: () => void;
}

export const useDeleteDeviceGroup = (props: DeleteDeviceGroupProps = {}) => {
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

// Membership changes touch the roster, the group's member count, and the list.
const invalidateMembership = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: orpc.deviceGroups.listDeviceGroupMembers.key(),
  });
  await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.getDeviceGroup.key() });
  await queryClient.invalidateQueries({ queryKey: orpc.deviceGroups.listDeviceGroups.key() });
};

export const useAddDeviceGroupMembers = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.addDeviceGroupMembers.mutationOptions({
      onSettled: () => invalidateMembership(queryClient),
    }),
  );
};

export const useRemoveDeviceGroupMember = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.deviceGroups.removeDeviceGroupMember.mutationOptions({
      onSettled: () => invalidateMembership(queryClient),
    }),
  );
};
