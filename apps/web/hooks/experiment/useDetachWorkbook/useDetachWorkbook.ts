import { tsr } from "@/lib/tsr";

export const useDetachWorkbook = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.detachWorkbook.useMutation({
    // Detach has no workbookId in its response; read it from the experiment cache.
    onMutate: (variables) => {
      const experiment = queryClient.getQueryData<{ body: { workbookId?: string | null } }>([
        "experiment",
        variables.params.id,
      ]);
      return { workbookId: experiment?.body.workbookId ?? undefined };
    },
    onSettled: async (_data, _error, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
      const workbookId = context?.workbookId;
      if (workbookId) {
        await queryClient.invalidateQueries({ queryKey: ["workbook", workbookId] });
        await queryClient.invalidateQueries({ queryKey: ["workbookVersions", workbookId] });
      }
    },
  });
};
