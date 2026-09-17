import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** The route carries only the run id, so device-scoped calibration queries are invalidated by prefix. */
export const useApproveCalibrationRun = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.approveCalibrationRun.mutationOptions({
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.iot.getCalibrationRun.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceCalibrationRuns.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.getActiveDeviceCalibration.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceCalibrations.key() }),
        ]);
      },
    }),
  );
};
