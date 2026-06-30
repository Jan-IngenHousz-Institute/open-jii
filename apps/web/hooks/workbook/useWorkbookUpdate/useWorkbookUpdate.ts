import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";

interface WorkbookUpdateProps {
  onSuccess?: (workbook: Workbook) => void;
}

export const useWorkbookUpdate = (workbookId: string, props: WorkbookUpdateProps = {}) => {
  const queryClient = useQueryClient();
  const workbookKey = orpc.workbooks.getWorkbook.queryKey({ input: { id: workbookId } });

  return useMutation(
    orpc.workbooks.updateWorkbook.mutationOptions({
      // Keyed so consumers (e.g. the linked-workbook upgrade banner) can detect
      // an in-flight autosave via `useIsMutating` and hold transient state.
      mutationKey: ["workbook", workbookId, "update"],
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: workbookKey });
        await queryClient.cancelQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });

        const previousWorkbook = queryClient.getQueryData(workbookKey);

        // Optimistically merge scalar fields (name/description/metadata) into the
        // detail cache. `cells` is left to the post-settle refetch: the editor
        // owns live cell state, and the update-input cell type is structurally
        // looser than the stored shape (optional isCollapsed).
        queryClient.setQueryData(workbookKey, (old) => {
          if (!old) return old;
          const { cells: _cells, ...rest } = variables;
          return { ...old, ...rest };
        });

        return { previousWorkbook };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousWorkbook) {
          queryClient.setQueryData(workbookKey, context.previousWorkbook);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: workbookKey });
        await queryClient.invalidateQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
