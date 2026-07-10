import { tsr } from "@/lib/tsr";

interface DeleteIotDeviceProps {
  onSuccess?: () => void;
}

export const useDeleteIotDevice = (props: DeleteIotDeviceProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.iot.deleteIotDevice.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onSuccess: () => {
      props.onSuccess?.();
    },
  });
};
