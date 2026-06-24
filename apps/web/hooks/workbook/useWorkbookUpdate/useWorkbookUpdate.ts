import type { Workbook } from "@repo/api/schemas/workbook.schema";

import { tsr } from "../../../lib/tsr";

interface WorkbookUpdateProps {
  onSuccess?: (workbook: Workbook) => void;
}

export const useWorkbookUpdate = (workbookId: string, props: WorkbookUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.workbooks.updateWorkbook.useMutation({
    // Keyed so consumers (e.g. the linked-workbook upgrade banner) can detect
    // an in-flight autosave via `useIsMutating` and hold transient state.
    mutationKey: ["workbook", workbookId, "update"],
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["workbook", workbookId],
      });
      await queryClient.cancelQueries({
        queryKey: ["workbooks"],
      });

      const previousWorkbook = queryClient.getQueryData<{
        body: Workbook;
      }>(["workbook", workbookId]);

      if (previousWorkbook) {
        queryClient.setQueryData(["workbook", workbookId], {
          ...previousWorkbook,
          body: {
            ...previousWorkbook.body,
            ...variables.body,
          },
        });
      }

      const previousWorkbooks = queryClient.getQueryData<{
        body: Workbook[];
      }>(["workbooks"]);

      if (previousWorkbooks?.body) {
        queryClient.setQueryData(["workbooks"], {
          ...previousWorkbooks,
          body: previousWorkbooks.body.map((workbook) =>
            workbook.id === workbookId ? { ...workbook, ...variables.body } : workbook,
          ),
        });
      }

      return { previousWorkbook, previousWorkbooks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousWorkbook) {
        queryClient.setQueryData(["workbook", workbookId], context.previousWorkbook);
      }
      if (context?.previousWorkbooks) {
        queryClient.setQueryData(["workbooks"], context.previousWorkbooks);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workbook", workbookId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["workbooks"],
      });
    },
    onSuccess: (data) => {
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
