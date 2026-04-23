import { tsr } from "@/lib/tsr";

/**
 * Hook to detach the workbook from an experiment.
 * The workbook version reference is kept for historical purposes.
 */
export const useDetachWorkbook = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.detachWorkbook.useMutation({
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
