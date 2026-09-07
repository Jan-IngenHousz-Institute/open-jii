import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Reject a computed run; its diagnostics stay on record, nothing is applied. */
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
