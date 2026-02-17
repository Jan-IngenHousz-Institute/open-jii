import { tsr } from "@/lib/tsr";

interface UseInitiateExportProps {
  onSuccess?: () => void;
}

export const useInitiateExport = ({ onSuccess }: UseInitiateExportProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.initiateExport.useMutation({
    onSuccess: async (data, variables) => {
      // Invalidate the exports list to show the new in-progress export
      await queryClient.invalidateQueries({
        queryKey: ["exports", variables.params.id, variables.body.tableName],
      });

      onSuccess?.();
    },
  });
};
