import type { Workbook } from "@repo/api/schemas/workbook.schema";

import { tsr } from "../../../lib/tsr";

export const useWorkbookDelete = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.workbooks.deleteWorkbook.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["workbooks"],
      });

      const previousWorkbooks = queryClient.getQueryData<{
        body: Workbook[];
      }>(["workbooks"]);

      if (previousWorkbooks?.body) {
        queryClient.setQueryData(["workbooks"], {
          ...previousWorkbooks,
          body: previousWorkbooks.body.filter((workbook) => workbook.id !== variables.params.id),
        });
      }

      queryClient.removeQueries({
        queryKey: ["workbook", variables.params.id],
      });

      return { previousWorkbooks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousWorkbooks) {
        queryClient.setQueryData(["workbooks"], context.previousWorkbooks);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workbooks"],
      });
    },
  });
};
