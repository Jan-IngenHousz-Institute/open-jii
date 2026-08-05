import { orpc, orpcClient } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import type { UpdateWorkbookRequestBody } from "@repo/api/domains/workbook/workbook.schema";

interface WorkbookUpdateProps {
  onSuccess?: (workbook: Workbook) => void;
  /** Initial fallback until the workbook detail cache is populated. */
  revision?: number;
}

type WorkbookUpdateVariables = Omit<UpdateWorkbookRequestBody, "expectedRevision"> & {
  id: string;
};

export const useWorkbookUpdate = (workbookId: string, props: WorkbookUpdateProps = {}) => {
  const queryClient = useQueryClient();
  const workbookKey = orpc.workbooks.getWorkbook.queryKey({ input: { id: workbookId } });

  return useMutation<Workbook, Error, WorkbookUpdateVariables, { previousWorkbook?: Workbook }>({
    mutationKey: ["workbook", workbookId, "update"],
    // Every writer for this workbook shares a serial scope. The next writer
    // reads the revision installed by the previous response before it runs.
    scope: { id: `workbook:${workbookId}` },
    mutationFn: async (variables) => {
      const current = queryClient.getQueryData<Workbook>(workbookKey);
      const expectedRevision = current?.revision ?? props.revision;
      if (!expectedRevision) {
        throw new Error("Workbook revision is unavailable. Refresh and try again.");
      }
      return orpcClient.workbooks.updateWorkbook({ ...variables, expectedRevision });
    },
    // Keyed so consumers (e.g. the linked-workbook upgrade banner) can detect
    // an in-flight autosave via `useIsMutating` and hold transient state.
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: workbookKey });
      await queryClient.cancelQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });

      const previousWorkbook = queryClient.getQueryData<Workbook>(workbookKey);

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
      // Install the returned revision synchronously. A different hook
      // instance in the same serial scope may be the next queued writer.
      queryClient.setQueryData(workbookKey, data);
      props.onSuccess?.(data);
    },
  });
};
