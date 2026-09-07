import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Submit a captured payload for computation. The backend invokes the sandbox
 * and answers with the finished run, computed or not, so the caller reviews
 * the response rather than polling.
 */
export const useCreateCalibrationRun = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.createCalibrationRun.mutationOptions({
      onSettled: async (data, error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.iot.listDeviceCalibrationRuns.queryKey({
            input: { deviceId: variables.deviceId },
          }),
        });
      },
    }),
  );
};
