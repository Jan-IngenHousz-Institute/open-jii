import { tsr } from "@/shared/api/tsr";

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
