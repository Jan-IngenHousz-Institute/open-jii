import { tsr } from "@/lib/tsr";

interface UseInitiateExportProps {
  onSuccess?: () => void;
}

export const useInitiateExport = ({ onSuccess }: UseInitiateExportProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.initiateExport.useMutation({
    onSuccess: async (data, variables) => {
      // Invalidate and refetch the exports list eagerly so the data is
      // already in the cache when the user navigates back to the list step.
      // Using refetchType "all" ensures inactive queries are also refetched.
      await queryClient.invalidateQueries({
        queryKey: ["exports", variables.params.id, variables.body.tableName],
        refetchType: "all",
      });

      onSuccess?.();
    },
  });
};
