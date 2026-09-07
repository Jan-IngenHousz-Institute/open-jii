import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Record what the client wrote to the device, block by block. The platform
 * never reaches hardware itself, so this report is the only evidence a
 * calibration is on the device rather than merely approved.
 */
export const useReportDeviceCalibrationWrite = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.reportDeviceCalibrationWrite.mutationOptions({
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.iot.getActiveDeviceCalibration.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listDeviceCalibrations.key() }),
        ]);
      },
    }),
  );
};
