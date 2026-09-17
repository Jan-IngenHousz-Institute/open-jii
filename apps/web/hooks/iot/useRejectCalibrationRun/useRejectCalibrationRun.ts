import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useRejectCalibrationRun = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.rejectCalibrationRun.mutationOptions({
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.iot.getCalibrationRun.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceCalibrationRuns.key() }),
        ]);
      },
    }),
  );
};
