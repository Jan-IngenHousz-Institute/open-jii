import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CalibrationDefinition } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

export const useCreateCalibrationDefinition = (options?: {
  onSuccess?: (definition: CalibrationDefinition) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.createCalibrationDefinition.mutationOptions({
      onSuccess: async (definition) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.iot.listCalibrationDefinitions.key(),
        });
        options?.onSuccess?.(definition);
      },
    }),
  );
};
