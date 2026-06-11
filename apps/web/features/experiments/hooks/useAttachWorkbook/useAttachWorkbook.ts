import { tsr } from "@/shared/api/tsr";

export const useAttachWorkbook = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.attachWorkbook.useMutation({
    onSettled: async (data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experimentAccess", variables.params.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["experiments"],
      });
      const workbookId = data?.body.workbookId;
      if (workbookId) {
        await queryClient.invalidateQueries({ queryKey: ["workbook", workbookId] });
        await queryClient.invalidateQueries({ queryKey: ["workbookVersions", workbookId] });
      }
    },
  });
};
