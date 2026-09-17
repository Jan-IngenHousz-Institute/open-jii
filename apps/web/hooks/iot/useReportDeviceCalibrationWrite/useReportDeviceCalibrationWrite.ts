import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** The only evidence a calibration is on the device rather than merely approved. */
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
