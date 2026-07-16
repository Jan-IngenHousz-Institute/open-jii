import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UseInitiateExportProps {
  onSuccess?: () => void;
}

export const useInitiateExport = ({ onSuccess }: UseInitiateExportProps = {}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.initiateExport.mutationOptions({
      onSuccess: async (_data, variables) => {
        // Invalidate and refetch the exports list eagerly so the data is
        // already in the cache when the user navigates back to the list step.
        // Using refetchType "all" ensures inactive queries are also refetched.
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExports.queryKey({
            input: { id: variables.id, tableName: variables.tableName },
          }),
          refetchType: "all",
        });

        onSuccess?.();
      },
    }),
  );
};
