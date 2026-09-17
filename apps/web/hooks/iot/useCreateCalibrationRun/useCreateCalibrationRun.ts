import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** The backend runs the sandbox synchronously and answers with the finished run; nothing polls. */
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
