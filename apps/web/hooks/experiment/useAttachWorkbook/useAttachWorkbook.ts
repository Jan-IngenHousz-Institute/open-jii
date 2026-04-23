import { tsr } from "@/lib/tsr";

/**
 * Hook to attach a workbook to an experiment, publishing a version.
 */
export const useAttachWorkbook = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.attachWorkbook.useMutation({
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
    },
  });
};
