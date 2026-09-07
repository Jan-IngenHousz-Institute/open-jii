import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Approve a computed run: its computed blocks become the device's active
 * calibration and the previous one is superseded. The route carries only the
 * run id, so every device-scoped calibration query is invalidated by prefix.
 */
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
