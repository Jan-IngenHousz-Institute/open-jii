import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useUpdateCalibrationDefinition = (definitionId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.iot.updateCalibrationDefinition.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.iot.getCalibrationDefinition.key({ input: { definitionId } }),
          }),
          queryClient.invalidateQueries({ queryKey: orpc.iot.listCalibrationDefinitions.key() }),
        ]);
      },
    }),
  );
};
